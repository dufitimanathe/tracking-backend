import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { getSkipTake } from '../common/dto/pagination.dto';
import {
  DomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';
import {
  ErrorCode,
  MotorcycleStatus,
  RiderAvailabilityStatus,
  RiderStatus,
} from '../common/enums';
import { Company } from '../companies/entities/company.entity';
import { MailService } from '../mail/mail.service';
import { Motorcycle } from '../motorcycles/entities/motorcycle.entity';
import { Rider } from '../riders/entities/rider.entity';
import { User } from '../users/entities/user.entity';
import { AssignRiderMotorcycleDto } from './dto/assign-rider-motorcycle.dto';
import { AssignmentQueryDto } from './dto/assignment-query.dto';
import { AssignmentResponseDto } from './dto/assignment-response.dto';
import { RiderMotorcycleAssignment } from './entities/rider-motorcycle-assignment.entity';

@Injectable()
export class RiderMotorcycleAssignmentsService {
  private readonly logger = new Logger(RiderMotorcycleAssignmentsService.name);

  private static readonly SORT_FIELDS = new Set([
    'assignedAt',
    'createdAt',
    'unassignedAt',
  ]);

  constructor(
    @InjectRepository(RiderMotorcycleAssignment)
    private readonly assignmentRepository: Repository<RiderMotorcycleAssignment>,
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
    @InjectRepository(Motorcycle)
    private readonly motorcycleRepository: Repository<Motorcycle>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly mailService: MailService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    companyId: string,
    query: AssignmentQueryDto,
  ): Promise<{ items: AssignmentResponseDto[]; total: number }> {
    const { skip, take } = getSkipTake(query.page, query.limit);
    const qb = this.assignmentRepository
      .createQueryBuilder('assignment')
      .where('assignment.companyId = :companyId', { companyId });

    if (query.active !== undefined) {
      qb.andWhere('assignment.active = :active', { active: query.active });
    }

    if (query.riderId) {
      qb.andWhere('assignment.riderId = :riderId', { riderId: query.riderId });
    }

    if (query.motorcycleId) {
      qb.andWhere('assignment.motorcycleId = :motorcycleId', {
        motorcycleId: query.motorcycleId,
      });
    }

    const { field, order } = this.parseSort(query.sort);
    qb.orderBy(`assignment.${field}`, order);

    const [items, total] = await qb.skip(skip).take(take).getManyAndCount();

    return {
      items: items.map(AssignmentResponseDto.fromEntity),
      total,
    };
  }

  async assign(
    companyId: string,
    dto: AssignRiderMotorcycleDto,
    assignedById: string,
  ): Promise<AssignmentResponseDto> {
    const rider = await this.riderRepository.findOne({
      where: { id: dto.riderId, companyId },
    });

    if (!rider) {
      throw new NotFoundDomainException('Rider not found.');
    }

    if (rider.status !== RiderStatus.ACTIVE) {
      throw new DomainException(
        ErrorCode.RIDER_NOT_AVAILABLE,
        'Only active riders can be assigned to motorcycles.',
      );
    }

    const motorcycle = await this.motorcycleRepository.findOne({
      where: { id: dto.motorcycleId, companyId },
    });

    if (!motorcycle) {
      throw new NotFoundDomainException('Motorcycle not found.');
    }

    if (motorcycle.status !== MotorcycleStatus.ACTIVE) {
      throw new DomainException(
        ErrorCode.MOTORCYCLE_NOT_AVAILABLE,
        'Only active motorcycles can be assigned to riders.',
      );
    }

    const assignment = await this.dataSource.transaction(async (manager) => {
      const assignmentRepo = manager.getRepository(RiderMotorcycleAssignment);
      const riderRepo = manager.getRepository(Rider);
      const now = new Date();

      await assignmentRepo
        .createQueryBuilder()
        .update(RiderMotorcycleAssignment)
        .set({ active: false, unassignedAt: now })
        .where('companyId = :companyId', { companyId })
        .andWhere('motorcycleId = :motorcycleId', { motorcycleId: dto.motorcycleId })
        .andWhere('active = true')
        .execute();

      await assignmentRepo
        .createQueryBuilder()
        .update(RiderMotorcycleAssignment)
        .set({ active: false, unassignedAt: now })
        .where('companyId = :companyId', { companyId })
        .andWhere('riderId = :riderId', { riderId: dto.riderId })
        .andWhere('active = true')
        .execute();

      const created = await assignmentRepo.save(
        assignmentRepo.create({
          companyId,
          riderId: dto.riderId,
          motorcycleId: dto.motorcycleId,
          assignedById,
          assignedAt: now,
          active: true,
        }),
      );

      await riderRepo.update(
        { id: rider.id, companyId },
        { availabilityStatus: RiderAvailabilityStatus.OFFLINE },
      );

      return created;
    });

    await this.notifyRider(companyId, rider.userId, {
      subject: 'Motorcycle assigned on FleetOps',
      headline: 'A motorcycle was assigned to you.',
      bodyLines: [
        `Plate: ${motorcycle.plateNumber}.`,
        'You can now go Online in the FleetOps app so dispatch can track your GPS.',
      ],
    });

    return AssignmentResponseDto.fromEntity(assignment);
  }

  async unassign(
    companyId: string,
    assignmentId: string,
  ): Promise<AssignmentResponseDto> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id: assignmentId, companyId },
    });

    if (!assignment) {
      throw new NotFoundDomainException('Assignment not found.');
    }

    if (!assignment.active) {
      throw new DomainException(
        ErrorCode.TRIP_INVALID_STATE,
        'Assignment is already inactive.',
      );
    }

    assignment.active = false;
    assignment.unassignedAt = new Date();

    const saved = await this.assignmentRepository.save(assignment);

    await this.riderRepository.update(
      { id: assignment.riderId, companyId },
      { availabilityStatus: RiderAvailabilityStatus.OFFLINE },
    );

    const rider = await this.riderRepository.findOne({
      where: { id: assignment.riderId, companyId },
    });
    if (rider) {
      await this.notifyRider(companyId, rider.userId, {
        subject: 'Motorcycle unassigned on FleetOps',
        headline: 'Your motorcycle assignment was removed.',
        bodyLines: [
          'You were set offline. Ask your admin to assign a motorcycle before going Online again.',
        ],
      });
    }

    return AssignmentResponseDto.fromEntity(saved);
  }

  async countActiveByCompany(companyId: string): Promise<number> {
    return this.assignmentRepository.count({
      where: { companyId, active: true },
    });
  }

  private async notifyRider(
    companyId: string,
    userId: string,
    notice: { subject: string; headline: string; bodyLines: string[] },
  ): Promise<void> {
    const [user, company] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId } }),
      this.companyRepository.findOne({ where: { id: companyId } }),
    ]);
    if (!user?.email) {
      this.logger.warn(`No email for user ${userId}; skipped assignment notice`);
      return;
    }
    await this.mailService.sendRiderNoticeEmail({
      to: user.email,
      firstName: user.firstName || 'Rider',
      companyName: company?.name ?? 'your company',
      subject: notice.subject,
      headline: notice.headline,
      bodyLines: notice.bodyLines,
    });
  }

  private parseSort(sort?: string): { field: string; order: 'ASC' | 'DESC' } {
    const [rawField, rawOrder] = (sort ?? 'assignedAt:DESC').split(':');
    const field = RiderMotorcycleAssignmentsService.SORT_FIELDS.has(rawField)
      ? rawField
      : 'assignedAt';
    const order = rawOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    return { field, order };
  }
}
