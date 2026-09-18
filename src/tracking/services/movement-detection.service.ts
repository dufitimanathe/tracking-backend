import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TrackingMovementState } from '../../common/enums';

export interface MovementContext {
  movementState: TrackingMovementState;
  candidateSince?: Date | null;
  lastLatitude?: number | null;
  lastLongitude?: number | null;
}

export interface MovementUpdate {
  movementState: TrackingMovementState;
  candidateSince: Date | null;
  transitioned: boolean;
}

@Injectable()
export class MovementDetectionService {
  constructor(private readonly configService: ConfigService) {}

  private cfg() {
    return this.configService.get('app.tracking', { infer: true })!;
  }

  evaluate(
    ctx: MovementContext,
    input: {
      speedMps: number | null;
      latitude: number;
      longitude: number;
      at: Date;
    },
  ): MovementUpdate {
    const tracking = this.cfg();
    const speed = input.speedMps ?? 0;
    const isMovingSample = speed >= tracking.movingSpeedThresholdMps;
    const isStoppedSample = speed <= tracking.stoppedSpeedThresholdMps;

    let { movementState, candidateSince } = ctx;
    if (
      movementState !== TrackingMovementState.MOVING &&
      movementState !== TrackingMovementState.STOPPED &&
      movementState !== TrackingMovementState.TRACKING
    ) {
      movementState = TrackingMovementState.TRACKING;
    }

    let next = movementState;
    let nextCandidate = candidateSince ?? null;
    let transitioned = false;

    if (movementState === TrackingMovementState.MOVING) {
      if (isStoppedSample) {
        if (!nextCandidate) nextCandidate = input.at;
        const held =
          (input.at.getTime() - nextCandidate.getTime()) / 1000 >=
          tracking.stoppedConfirmSeconds;
        if (held) {
          next = TrackingMovementState.STOPPED;
          nextCandidate = null;
          transitioned = true;
        }
      } else {
        nextCandidate = null;
      }
    } else if (movementState === TrackingMovementState.STOPPED) {
      if (isMovingSample) {
        if (!nextCandidate) nextCandidate = input.at;
        const held =
          (input.at.getTime() - nextCandidate.getTime()) / 1000 >=
          tracking.movingConfirmSeconds;
        if (held) {
          next = TrackingMovementState.MOVING;
          nextCandidate = null;
          transitioned = true;
        }
      } else {
        nextCandidate = null;
      }
    } else {
      // TRACKING bootstrap
      if (isMovingSample) {
        next = TrackingMovementState.MOVING;
        transitioned = true;
        nextCandidate = null;
      } else if (isStoppedSample) {
        next = TrackingMovementState.STOPPED;
        transitioned = true;
        nextCandidate = null;
      }
    }

    return {
      movementState: next,
      candidateSince: nextCandidate,
      transitioned,
    };
  }
}
