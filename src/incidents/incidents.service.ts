import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getSkipTake, PaginationQueryDto } from '../common/dto/pagination.dto';
import {
  ConflictDomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';
import { ErrorCode, IncidentStatus } from '../common/enums';
import { IncidentResponseDto } from './dto/incident-response.dto';
import { Incident } from './entities/incident.entity';

@Injectable()
export class IncidentsService {
  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
  ) {}

  async listForCompany(
    companyId: string,
    query: PaginationQueryDto,
  ): Promise<{ items: IncidentResponseDto[]; total: number }> {
    const { skip, take } = getSkipTake(query.page, query.limit);

    const [items, total] = await this.incidentRepository.findAndCount({
      where: { companyId },
      order: { detectedAt: 'DESC' },
      skip,
      take,
    });

    return {
      items: items.map(IncidentResponseDto.fromEntity),
      total,
    };
  }

  async acknowledge(
    companyId: string,
    incidentId: string,
    actorId: string,
  ): Promise<IncidentResponseDto> {
    const incident = await this.findByIdOrFail(companyId, incidentId);

    if (incident.status === IncidentStatus.RESOLVED) {
      throw new ConflictDomainException(
        ErrorCode.INCIDENT_ALREADY_RESOLVED,
        'Cannot acknowledge a resolved incident.',
      );
    }

    incident.status = IncidentStatus.ACKNOWLEDGED;
    incident.acknowledgedAt = new Date();
    incident.acknowledgedById = actorId;

    const saved = await this.incidentRepository.save(incident);
    return IncidentResponseDto.fromEntity(saved);
  }

  async resolve(
    companyId: string,
    incidentId: string,
    actorId: string,
  ): Promise<IncidentResponseDto> {
    const incident = await this.findByIdOrFail(companyId, incidentId);

    if (incident.status === IncidentStatus.RESOLVED) {
      throw new ConflictDomainException(
        ErrorCode.INCIDENT_ALREADY_RESOLVED,
        'Incident is already resolved.',
      );
    }

    incident.status = IncidentStatus.RESOLVED;
    incident.resolvedAt = new Date();
    incident.resolvedById = actorId;

    const saved = await this.incidentRepository.save(incident);
    return IncidentResponseDto.fromEntity(saved);
  }

  async countOpen(companyId: string): Promise<number> {
    return this.incidentRepository.count({
      where: {
        companyId,
        status: IncidentStatus.OPEN,
      },
    });
  }

  async findRecentAlerts(companyId: string, limit = 5): Promise<IncidentResponseDto[]> {
    const items = await this.incidentRepository.find({
      where: { companyId },
      order: { detectedAt: 'DESC' },
      take: limit,
    });
    return items.map(IncidentResponseDto.fromEntity);
  }

  private async findByIdOrFail(companyId: string, incidentId: string): Promise<Incident> {
    const incident = await this.incidentRepository.findOne({
      where: { id: incidentId, companyId },
    });
    if (!incident) {
      throw new NotFoundDomainException('Incident not found.');
    }
    return incident;
  }
}
