import { RidersService } from './riders.service';
import { Rider } from './entities/rider.entity';
import { RiderMotorcycleAssignment } from '../rider-motorcycle-assignments/entities/rider-motorcycle-assignment.entity';
import {
  ErrorCode,
  RiderAvailabilityStatus as Availability,
  RiderStatus,
  UserRole,
} from '../common/enums';
import type { AuthUser } from '../common/decorators/current-user.decorator';

const actor = { id: 'rider-user' } as AuthUser;

function setup(status = Availability.AWAITING_AVAILABILITY) {
  const rider = {
    id: 'rider',
    companyId: 'company',
    userId: actor.id,
    status: RiderStatus.ACTIVE,
    availabilityStatus: status,
  } as Rider;
  const riders = {
    findOne: jest.fn().mockResolvedValue(rider),
    save: jest.fn(async (value: Rider) => value),
  };
  const assignments = { findOne: jest.fn().mockResolvedValue({ active: true }) };
  const manager = {
    getRepository: (entity: unknown) =>
      entity === Rider ? riders : entity === RiderMotorcycleAssignment ? assignments : undefined,
  };
  const service = Object.assign(Object.create(RidersService.prototype), {
    dataSource: { transaction: (fn: (value: typeof manager) => unknown) => fn(manager) },
    userRepository: { find: jest.fn().mockResolvedValue([]) },
  }) as RidersService;
  const update = (next: Availability) =>
    service.updateAvailability(
      'company',
      'rider',
      { availabilityStatus: next },
      actor,
      UserRole.RIDER,
    );
  return { service, rider, riders, assignments, update };
}

describe('rider availability confirmation', () => {
  it('makes the rider eligible only after an explicit Ready request under the dispatch row lock', async () => {
    const ctx = setup();
    expect(ctx.rider.availabilityStatus).not.toBe(Availability.AVAILABLE);
    const result = await ctx.update(Availability.AVAILABLE);
    expect(result.availabilityStatus).toBe(Availability.AVAILABLE);
    expect(ctx.riders.findOne).toHaveBeenCalledWith({
      where: { id: 'rider', companyId: 'company' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(ctx.assignments.findOne).toHaveBeenCalledWith({
      where: { companyId: 'company', riderId: 'rider', active: true },
    });
  });

  it('records another passenger as BUSY and allows the rider to return to AVAILABLE', async () => {
    const ctx = setup(Availability.AVAILABLE);
    expect((await ctx.update(Availability.BUSY)).availabilityStatus).toBe(Availability.BUSY);
    expect(ctx.assignments.findOne).not.toHaveBeenCalled();
    expect((await ctx.update(Availability.AVAILABLE)).availabilityStatus).toBe(
      Availability.AVAILABLE,
    );
  });

  it.each([
    Availability.RESERVED,
    Availability.ASSIGNED,
    Availability.TO_PICKUP,
    Availability.WAITING_CUSTOMER,
    Availability.ON_TRIP,
  ])('rejects late availability taps after dispatch has moved the rider to %s', async (status) => {
    const ctx = setup(status);
    for (const next of [Availability.AVAILABLE, Availability.BUSY, Availability.OFFLINE]) {
      await expect(ctx.update(next)).rejects.toMatchObject({ code: ErrorCode.TRIP_INVALID_STATE });
    }
    expect(ctx.riders.save).not.toHaveBeenCalled();
  });

  it('does not mark the rider ready without an assigned motorcycle', async () => {
    const ctx = setup();
    ctx.assignments.findOne.mockResolvedValue(null);
    await expect(ctx.update(Availability.AVAILABLE)).rejects.toMatchObject({
      code: ErrorCode.MOTORCYCLE_NOT_AVAILABLE,
    });
    expect(ctx.riders.save).not.toHaveBeenCalled();
  });

  it('rejects changing another rider and rejects inactive riders', async () => {
    const ctx = setup();
    await expect(
      ctx.service.updateAvailability(
        'company',
        'rider',
        { availabilityStatus: Availability.AVAILABLE },
        { id: 'someone-else' } as AuthUser,
        UserRole.RIDER,
      ),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
    ctx.rider.status = RiderStatus.SUSPENDED;
    await expect(ctx.update(Availability.AVAILABLE)).rejects.toMatchObject({
      code: ErrorCode.RIDER_NOT_AVAILABLE,
    });
    expect(ctx.riders.save).not.toHaveBeenCalled();
  });

  it('allows finishing the day, but does not let the rider fabricate a system state', async () => {
    const ctx = setup(Availability.BUSY);
    expect((await ctx.update(Availability.OFFLINE)).availabilityStatus).toBe(Availability.OFFLINE);
    await expect(ctx.update(Availability.AWAITING_AVAILABILITY)).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
    });
  });
});
