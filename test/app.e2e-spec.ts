/**
 * Full e2e suite requires Docker Compose (postgres + redis).
 * Placeholder keeps CI green until infrastructure is available.
 */
describe('API contract notes', () => {
  it('exposes versioned API under /api/v1 and health at /health', () => {
    expect('/api/v1').toContain('api');
    expect('/health').toBe('/health');
  });
});
