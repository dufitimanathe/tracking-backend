import { TripsService } from './trips.service';
import { Trip } from './entities/trip.entity';
import { Rider } from '../riders/entities/rider.entity';
import { Motorcycle } from '../motorcycles/entities/motorcycle.entity';
import { TransportRequest } from '../transport-requests/entities/transport-request.entity';
import {
  ErrorCode,
  RiderAvailabilityStatus,
  TransportRequestStatus,
  TripStatus,
} from '../common/enums';
import type { AuthUser } from '../common/decorators/current-user.decorator';

function setup() {
  const rider = {
    id: 'rider',
    userId: 'user',
    availabilityStatus: RiderAvailabilityStatus.ON_TRIP,
  } as Rider;
  const trip = {
    id: 'trip',
    companyId: 'company',
    riderId: rider.id,
    transportRequestId: 'request',
    status: TripStatus.IN_PROGRESS,
    estimatedPrice: '2500',
    estimatedDistanceKm: '5',
  } as Trip;
  const request = { status: TransportRequestStatus.ASSIGNED } as TransportRequest;
  const repo = (value: unknown) => ({
    findOne: jest.fn().mockResolvedValue(value),
    save: jest.fn(async (entity: unknown) => entity),
  });
  const riders = repo(rider);
  const trips = repo(trip);
  const requests = repo(request);
  const repositories = new Map<unknown, ReturnType<typeof repo>>([
    [Trip, trips],
    [Rider, riders],
    [TransportRequest, requests],
    [Motorcycle, repo(null)],
  ]);
  const manager = { getRepository: (entity: unknown) => repositories.get(entity) };
  const billing = { createForCompletedTrip: jest.fn().mockResolvedValue(undefined) };
  const notify = jest.fn().mockResolvedValue(undefined);
  const service = Object.assign(Object.create(TripsService.prototype), {
    riderRepository: riders,
    dataSource: { transaction: (fn: (value: typeof manager) => unknown) => fn(manager) },
    billingService: billing,
    tripEventsService: { appendEvent: jest.fn().mockResolvedValue(undefined) },
    notifyRiderTripUpdate: notify,
    notifyEmployeeWhatsApp: jest.fn().mockResolvedValue(undefined),
  }) as TripsService;
  return { service, rider, trip, request, trips, riders, billing, notify };
}

describe('trip completion availability', () => {
  it('completes and bills the trip while keeping the rider out of the assignment pool', async () => {
    const ctx = setup();
    const completed = await ctx.service.complete('company', 'trip', { id: 'user' } as AuthUser);
    expect(completed.status).toBe(TripStatus.COMPLETED);
    expect(completed.completedAt).toBeInstanceOf(Date);
    expect(completed.finalPrice).toBe('2500');
    expect(ctx.request.status).toBe(TransportRequestStatus.COMPLETED);
    expect(ctx.rider.availabilityStatus).toBe(RiderAvailabilityStatus.AWAITING_AVAILABILITY);
    expect(ctx.riders.save).toHaveBeenCalledWith(
      expect.objectContaining({
        availabilityStatus: RiderAvailabilityStatus.AWAITING_AVAILABILITY,
      }),
    );
    expect(ctx.billing.createForCompletedTrip).toHaveBeenCalledWith('trip');
    expect(ctx.notify).toHaveBeenCalledWith(
      ctx.trip,
      expect.stringContaining('Ready for another ride'),
      expect.anything(),
    );
  });

  it('rejects a duplicate completion rather than resetting a rider who already confirmed readiness', async () => {
    const ctx = setup();
    ctx.trip.status = TripStatus.COMPLETED;
    ctx.rider.availabilityStatus = RiderAvailabilityStatus.AVAILABLE;
    await expect(
      ctx.service.complete('company', 'trip', { id: 'user' } as AuthUser),
    ).rejects.toMatchObject({ code: ErrorCode.TRIP_INVALID_STATE });
    expect(ctx.riders.save).not.toHaveBeenCalled();
    expect(ctx.billing.createForCompletedTrip).not.toHaveBeenCalled();
  });
});
