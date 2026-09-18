import { ConfigService } from '@nestjs/config';
import { TrackingMovementState } from '../../common/enums';
import { MovementDetectionService } from './movement-detection.service';

function makeService(): MovementDetectionService {
  const tracking = {
    movingSpeedThresholdMps: 1.5,
    stoppedSpeedThresholdMps: 0.6,
    movingConfirmSeconds: 8,
    stoppedConfirmSeconds: 45,
  };
  const config = {
    get: () => tracking,
  } as unknown as ConfigService;
  return new MovementDetectionService(config);
}

describe('MovementDetectionService', () => {
  const at = new Date('2026-01-01T10:00:00.000Z');

  it('bootstraps to MOVING from TRACKING', () => {
    const svc = makeService();
    const result = svc.evaluate(
      { movementState: TrackingMovementState.TRACKING },
      { speedMps: 8, latitude: -1.95, longitude: 30.06, at },
    );
    expect(result.movementState).toBe(TrackingMovementState.MOVING);
    expect(result.transitioned).toBe(true);
  });

  it('requires sustained stop before MOVING → STOPPED', () => {
    const svc = makeService();
    const t0 = at;
    const early = new Date(t0.getTime() + 10_000);
    const held = new Date(t0.getTime() + 60_000);

    const first = svc.evaluate(
      { movementState: TrackingMovementState.MOVING },
      { speedMps: 0.2, latitude: -1.95, longitude: 30.06, at: early },
    );
    expect(first.movementState).toBe(TrackingMovementState.MOVING);
    expect(first.candidateSince).toEqual(early);

    const second = svc.evaluate(
      {
        movementState: TrackingMovementState.MOVING,
        candidateSince: early,
      },
      { speedMps: 0.1, latitude: -1.95, longitude: 30.06, at: held },
    );
    expect(second.movementState).toBe(TrackingMovementState.STOPPED);
    expect(second.transitioned).toBe(true);
  });
});
