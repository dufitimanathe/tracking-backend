import { TransportParseIntent } from '../../common/enums';
import { MockTransportParser } from './mock-transport.parser';

describe('MockTransportParser', () => {
  const parser = new MockTransportParser();

  it('parses English from-to with high confidence', async () => {
    const result = await parser.parse('From Kimironko to Kacyiru at 3pm');
    expect(result.intent).toBe(TransportParseIntent.CREATE_TRANSPORT_REQUEST);
    expect(result.pickupText?.toLowerCase()).toContain('kimironko');
    expect(result.destinationText?.toLowerCase()).toContain('kacyiru');
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    expect(result.pickupLatitude).toBeUndefined();
    expect(result.destinationLatitude).toBeUndefined();
  });

  it('parses Kinyarwanda-style from-to', async () => {
    const result = await parser.parse('Nshaka motari kuva Remera kugera Nyabugogo');
    expect(result.intent).toBe(TransportParseIntent.CREATE_TRANSPORT_REQUEST);
    expect(result.language).toBe('rw');
    expect(result.pickupText).toBeTruthy();
    expect(result.destinationText).toBeTruthy();
  });

  it('parses French-style from-to', async () => {
    const result = await parser.parse('De Kimironko à Kigali Heights');
    expect(result.intent).toBe(TransportParseIntent.CREATE_TRANSPORT_REQUEST);
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('marks greeting intent', async () => {
    const result = await parser.parse('Muraho');
    expect(result.intent).toBe(TransportParseIntent.GREETING);
  });

  it('asks clarification when incomplete', async () => {
    const result = await parser.parse('I need a ride');
    expect(result.needsClarification || (result.missingFields?.length ?? 0) > 0).toBe(true);
    expect(result.confidence).toBeLessThan(0.75);
  });
});
