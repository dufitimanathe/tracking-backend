import { Injectable, Logger } from '@nestjs/common';
import { DevicePushTokensService } from './device-push-tokens.service';

export interface TripOfferPushPayload {
  tripId: string;
  companyId: string;
  pickupAddress: string;
  destinationAddress: string;
}

@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);
  private readonly endpoint = 'https://exp.host/--/api/v2/push/send';

  constructor(private readonly devicePushTokensService: DevicePushTokensService) {}

  async sendTripOfferAlarm(userId: string, offer: TripOfferPushPayload): Promise<void> {
    const tokens = await this.devicePushTokensService.findTokensForUser(userId);
    if (tokens.length === 0) {
      this.logger.debug(`No push tokens for user ${userId}`);
      return;
    }

    const messages = tokens.map((row) => ({
      to: row.token,
      title: 'New trip offer',
      body: `${offer.pickupAddress} → ${offer.destinationAddress}`,
      sound: 'trip_offer_alarm',
      priority: 'high' as const,
      channelId: 'trip_offers',
      categoryId: 'TRIP_OFFER',
      ttl: 120,
      data: {
        type: 'TRIP_OFFER',
        tripId: offer.tripId,
        companyId: offer.companyId,
        pickupAddress: offer.pickupAddress,
        destinationAddress: offer.destinationAddress,
      },
    }));

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        this.logger.warn(`Expo push HTTP ${response.status}: ${await response.text()}`);
        return;
      }

      const json = (await response.json()) as {
        data?: Array<{ status?: string; details?: { error?: string }; message?: string }>;
      };
      const results = Array.isArray(json.data) ? json.data : [];
      await Promise.all(
        results.map(async (result, index) => {
          if (result.status === 'error') {
            const err = result.details?.error ?? result.message ?? 'unknown';
            this.logger.warn(`Expo push failed for token index ${index}: ${err}`);
            if (err === 'DeviceNotRegistered' || err === 'InvalidCredentials') {
              await this.devicePushTokensService.removeTokenByValue(tokens[index].token);
            }
          }
        }),
      );
    } catch (error) {
      this.logger.warn(`Expo push send failed: ${String(error)}`);
    }
  }
}
