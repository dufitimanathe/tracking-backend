import { DispatchService } from './dispatch.service';
import {
  AssignmentMethod,
  ErrorCode,
  MotorcycleStatus,
  RiderAvailabilityStatus,
  RiderStatus,
  TransportRequestStatus,
  TripStatus,
} from '../common/enums';
import { Trip } from '../trips/entities/trip.entity';
import { Rider } from '../riders/entities/rider.entity';
import { Motorcycle } from '../motorcycles/entities/motorcycle.entity';
import { TransportRequest } from '../transport-requests/entities/transport-request.entity';
import { RiderMotorcycleAssignment } from '../rider-motorcycle-assignments/entities/rider-motorcycle-assignment.entity';
import { AssignmentAttempt } from './entities/assignment-attempt.entity';

function setup(status = TripStatus.SEARCHING_RIDER) {
  const trip = {
    id: 'trip',
    companyId: 'company',
    transportRequestId: 'request',
    status,
    pickupLatitude: -1,
    pickupLongitude: 30,
    riderId: null,
    motorcycleId: null,
    assignedAt: null,
  } as unknown as Trip;
  const rider = {
    id: 'rider',
    companyId: 'company',
    status: RiderStatus.ACTIVE,
    availabilityStatus: RiderAvailabilityStatus.AVAILABLE,
  };
  const request = { status: TransportRequestStatus.DISPATCHING };
  const repo = (value?: unknown) => ({
    findOne: jest.fn().mockResolvedValue(value),
    find: jest.fn().mockResolvedValue([]),
    exists: jest.fn().mockResolvedValue(false),
    save: jest.fn(async (entity) => entity),
    create: jest.fn((entity) => entity),
  });
  const trips = repo(trip);
  const riders = repo(rider);
  const motorcycles = repo({ id: 'bike', status: MotorcycleStatus.ACTIVE });
  const assignments = repo({ motorcycleId: 'bike' });
  const requests = repo(request);
  const attempts = repo();
  const repositories = new Map<unknown, ReturnType<typeof repo>>([
    [Trip, trips],
    [Rider, riders],
    [Motorcycle, motorcycles],
    [TransportRequest, requests],
    [RiderMotorcycleAssignment, assignments],
    [AssignmentAttempt, attempts],
  ]);
  const manager = { getRepository: (entity: unknown) => repositories.get(entity) };
  const dataSource = { transaction: jest.fn((fn) => fn(manager)) };
  const matching = {
    findManualCandidates: jest.fn().mockResolvedValue([]),
    findAndRankCandidates: jest
      .fn()
      .mockResolvedValue({ candidates: [], method: AssignmentMethod.POSTGIS_FALLBACK }),
  };
  const config = {
    get: (key: string) =>
      ({
        'app.ops.riderSearchRadiusMeters': 10000,
        'app.ops.riderLocationMaxAgeSeconds': 60,
        'app.ops.dispatchOfferTimeoutSeconds': 45,
      })[key],
  };
  const queue = {
    add: jest.fn().mockResolvedValue({}),
    getJobs: jest.fn().mockResolvedValue([]),
  };
  const redis = { set: jest.fn(), del: jest.fn(), get: jest.fn().mockResolvedValue(null) };
  const notifier = { notifyRequestStatus: jest.fn() };
  const notifications = { notifyRiderTripOffer: jest.fn() };
  const events = { appendEvent: jest.fn() };
  const service = new DispatchService(
    trips as never,
    riders as never,
    requests as never,
    attempts as never,
    motorcycles as never,
    repo() as never,
    matching as never,
    events as never,
    dataSource as never,
    config as never,
    queue as never,
    redis as never,
    notifier as never,
    notifications as never,
  );
  return {
    service,
    trip,
    rider,
    request,
    trips,
    riders,
    motorcycles,
    assignments,
    requests,
    attempts,
    matching,
    queue,
    redis,
    notifier,
  };
}

describe('Admin dispatch', () => {
  it.each([TripStatus.SEARCHING_RIDER, TripStatus.NO_RIDER_AVAILABLE])(
    'assigns a rider without GPS from %s and resolves their motorcycle',
    async (status) => {
      const ctx = setup(status);
      const result = await ctx.service.manualAssign('company', 'trip', 'rider');
      expect(result).toMatchObject({
        status: TripStatus.RIDER_ASSIGNED,
        riderId: 'rider',
        motorcycleId: 'bike',
      });
      expect(ctx.request.status).toBe(TransportRequestStatus.ASSIGNED);
      expect(ctx.queue.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ assignedAt: expect.any(String) }),
        expect.objectContaining({ jobId: expect.not.stringContaining(':'), delay: 45000 }),
      );
      expect(ctx.redis.del).toHaveBeenCalled();
    },
  );

  it.each([
    RiderAvailabilityStatus.RESERVED,
    RiderAvailabilityStatus.OFFLINE,
    RiderAvailabilityStatus.ON_TRIP,
    RiderAvailabilityStatus.AWAITING_AVAILABILITY,
    RiderAvailabilityStatus.BUSY,
  ])('rejects a driver who is %s', async (availabilityStatus) => {
    const ctx = setup();
    ctx.rider.availabilityStatus = availabilityStatus;
    await expect(ctx.service.manualAssign('company', 'trip', 'rider')).rejects.toMatchObject({
      code: ErrorCode.RIDER_NOT_AVAILABLE,
    });
    expect(ctx.trips.save).not.toHaveBeenCalled();
  });

  it.each([RiderAvailabilityStatus.AWAITING_AVAILABILITY, RiderAvailabilityStatus.BUSY])(
    'skips a stale automatic candidate who is now %s', async (availabilityStatus) => {
      const ctx = setup();
      ctx.rider.availabilityStatus = availabilityStatus;
      ctx.matching.findAndRankCandidates.mockResolvedValue({
        candidates: [{ riderId: 'rider', motorcycleId: 'bike', distanceMeters: 100 }],
        method: AssignmentMethod.POSTGIS_FALLBACK,
      });
      await ctx.service.startAutomaticDispatch('trip');
      expect(ctx.trip.riderId).toBeNull();
      expect(ctx.rider.availabilityStatus).toBe(availabilityStatus);
      expect(ctx.riders.save).not.toHaveBeenCalled();
      expect(ctx.queue.add).not.toHaveBeenCalledWith('dispatch-timeout', expect.anything(), expect.anything());
    },
  );

  it('rejects suspended drivers, unrelated motorcycles, and double booking', async () => {
    const ctx = setup();
    ctx.rider.status = RiderStatus.SUSPENDED;
    await expect(ctx.service.manualAssign('company', 'trip', 'rider')).rejects.toMatchObject({
      code: ErrorCode.RIDER_NOT_AVAILABLE,
    });
    ctx.rider.status = RiderStatus.ACTIVE;
    await expect(
      ctx.service.manualAssign('company', 'trip', 'rider', 'other-bike'),
    ).rejects.toMatchObject({ code: ErrorCode.MOTORCYCLE_NOT_AVAILABLE });
    ctx.trips.exists.mockResolvedValue(true);
    await expect(ctx.service.manualAssign('company', 'trip', 'rider')).rejects.toMatchObject({
      code: ErrorCode.RIDER_NOT_AVAILABLE,
    });
    expect(ctx.trips.save).not.toHaveBeenCalled();
  });

  it('rejects cross-company/missing riders and missing motorcycle assignments', async () => {
    const ctx = setup();
    ctx.riders.findOne.mockResolvedValueOnce(null);
    await expect(ctx.service.manualAssign('company', 'trip', 'rider')).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
    expect(ctx.riders.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rider', companyId: 'company' } }),
    );
    ctx.assignments.findOne.mockResolvedValue(null);
    await expect(ctx.service.manualAssign('company', 'trip', 'rider')).rejects.toMatchObject({
      code: ErrorCode.MOTORCYCLE_NOT_AVAILABLE,
    });
  });

  it('rejects assignment once a trip is in progress', async () => {
    const ctx = setup(TripStatus.IN_PROGRESS);
    await expect(ctx.service.manualAssign('company', 'trip', 'rider')).rejects.toMatchObject({
      code: ErrorCode.TRIP_INVALID_STATE,
    });
  });

  it('allows nearest assignment using last-known location regardless of age', async () => {
    const ctx = setup();
    ctx.matching.findManualCandidates.mockResolvedValue([
      { riderId: 'rider', motorcycleId: 'bike', distanceMeters: 50000, locationAgeSeconds: 172800 },
      { riderId: 'unknown', motorcycleId: 'bike2' },
    ]);
    const recommendations = await ctx.service.getAssignmentRecommendations('company', 'trip');
    expect(recommendations.candidates).toHaveLength(2);
    expect(recommendations.candidates[0]).toMatchObject({ recommended: true, locationStale: false });
    expect(recommendations.candidates[1].distanceMeters).toBeUndefined();
    const result = await ctx.service.assignNearest('company', 'trip', 'admin');
    expect(result.riderId).toBe('rider');
  });

  it('does not invent a nearest driver when all locations are missing', async () => {
    const ctx = setup();
    ctx.matching.findManualCandidates.mockResolvedValue([
      { riderId: 'rider', motorcycleId: 'bike' },
    ]);
    await expect(ctx.service.assignNearest('company', 'trip', 'admin')).rejects.toMatchObject({
      code: ErrorCode.NO_RIDER_AVAILABLE,
    });
    expect(ctx.trips.save).not.toHaveBeenCalled();
  });
});

describe('Dispatch outcomes and offer expiry', () => {
  it('reports an exhausted search and keeps the request open for admin assignment', async () => {
    const ctx = setup();
    await ctx.service.startAutomaticDispatch('trip');
    expect(ctx.trip.status).toBe(TripStatus.NO_RIDER_AVAILABLE);
    expect(ctx.request.status).toBe(TransportRequestStatus.DISPATCHING);
    expect(ctx.notifier.notifyRequestStatus).toHaveBeenCalledWith(
      'company',
      'request',
      expect.stringContaining('awaiting admin'),
    );
  });

  it('does not send a lagging no-rider WhatsApp after an admin assign wins the race', async () => {
    const notifier = { notifyRequestStatus: jest.fn() };
    const redis = { set: jest.fn(), del: jest.fn(), get: jest.fn().mockResolvedValue(null) };
    const matching = {
      findManualCandidates: jest.fn().mockResolvedValue([]),
      findAndRankCandidates: jest
        .fn()
        .mockResolvedValue({ candidates: [], method: AssignmentMethod.POSTGIS_FALLBACK }),
    };
    const tripRepo = {
      findOne: jest
        .fn()
        // startAutomaticDispatch load
        .mockResolvedValueOnce({
          id: 'trip',
          companyId: 'company',
          transportRequestId: 'request',
          status: TripStatus.SEARCHING_RIDER,
          pickupLatitude: -1,
          pickupLongitude: 30,
          riderId: null,
        })
        // post markNoRiderAvailable re-check — admin already assigned
        .mockResolvedValueOnce({
          id: 'trip',
          status: TripStatus.RIDER_ASSIGNED,
          riderId: 'rider',
        }),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      exists: jest.fn(),
    };
    const service = new DispatchService(
      tripRepo as never,
      { findOne: jest.fn(), find: jest.fn(), save: jest.fn() } as never,
      { findOne: jest.fn(), save: jest.fn() } as never,
      { findOne: jest.fn(), save: jest.fn(), create: jest.fn() } as never,
      { findOne: jest.fn(), find: jest.fn() } as never,
      { findOne: jest.fn(), find: jest.fn() } as never,
      matching as never,
      { appendEvent: jest.fn() } as never,
      {
        transaction: jest.fn(async (fn: (manager: unknown) => Promise<unknown>) => {
          const tripDuringTx = {
            id: 'trip',
            companyId: 'company',
            transportRequestId: 'request',
            status: TripStatus.SEARCHING_RIDER,
            riderId: null,
          };
          return fn({
            getRepository: (entity: unknown) => {
              if (entity === Trip) {
                return {
                  findOne: jest.fn().mockResolvedValue(tripDuringTx),
                  save: jest.fn(async (entity) => entity),
                };
              }
              if (entity === TransportRequest) {
                return {
                  findOne: jest.fn().mockResolvedValue({ status: TransportRequestStatus.DISPATCHING }),
                  save: jest.fn(async (entity) => entity),
                };
              }
              return { findOne: jest.fn(), save: jest.fn() };
            },
          });
        }),
      } as never,
      {
        get: (key: string) =>
          ({
            'app.ops.riderSearchRadiusMeters': 10000,
            'app.ops.riderLocationMaxAgeSeconds': 60,
            'app.ops.dispatchOfferTimeoutSeconds': 45,
          })[key],
      } as never,
      { add: jest.fn(), getJobs: jest.fn().mockResolvedValue([]) } as never,
      redis as never,
      notifier as never,
      { notifyRiderTripOffer: jest.fn() } as never,
    );

    await service.startAutomaticDispatch('trip');
    expect(notifier.notifyRequestStatus).not.toHaveBeenCalled();
  });

  it('cancels pending offer timeouts when an admin assigns', async () => {
    const ctx = setup();
    const remove = jest.fn().mockResolvedValue(undefined);
    ctx.queue.getJobs.mockResolvedValue([
      { name: 'dispatch-timeout', data: { tripId: 'trip', riderId: 'old' }, remove },
      { name: 'dispatch-timeout', data: { tripId: 'other', riderId: 'x' }, remove: jest.fn() },
    ]);
    await ctx.service.manualAssign('company', 'trip', 'rider');
    expect(ctx.queue.getJobs).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
  });

  it('ignores an obsolete timeout for the same rider after reassignment', async () => {
    const ctx = setup(TripStatus.RIDER_ASSIGNED);
    ctx.trip.riderId = 'rider';
    ctx.trip.assignedAt = new Date('2026-09-24T10:00:00Z');
    await ctx.service.handleOfferTimeout('trip', 'rider', '2026-09-24T09:00:00.000Z');
    expect(ctx.trips.save).not.toHaveBeenCalled();
    expect(ctx.redis.get).not.toHaveBeenCalled();
  });

  it('releases an expired offer and finishes when there are no remaining candidates', async () => {
    const ctx = setup(TripStatus.RIDER_ASSIGNED);
    ctx.trip.riderId = 'rider';
    ctx.trip.assignedAt = new Date();
    ctx.rider.availabilityStatus = RiderAvailabilityStatus.RESERVED;
    await ctx.service.handleOfferTimeout('trip', 'rider', ctx.trip.assignedAt.toISOString());
    expect(ctx.trip.status).toBe(TripStatus.NO_RIDER_AVAILABLE);
    expect(ctx.rider.availabilityStatus).toBe(RiderAvailabilityStatus.AVAILABLE);
  });

  it('does not offer a declined trip back to the same single driver', async () => {
    const ctx = setup();
    await ctx.service.continueDispatch('trip');
    expect(ctx.matching.findAndRankCandidates).not.toHaveBeenCalled();
    expect(ctx.trip.status).toBe(TripStatus.NO_RIDER_AVAILABLE);
  });
});
