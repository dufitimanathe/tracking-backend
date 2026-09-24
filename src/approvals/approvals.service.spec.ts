import { ApprovalsService } from './approvals.service';

describe('Approval dispatch notifications', () => {
  it('sends searching before dispatch sends its final outcome', async () => {
    const calls: string[] = [];
    const approvals = { findOne: jest.fn().mockResolvedValue({ id: 'approval' }) };
    const transaction = { transaction: jest.fn().mockResolvedValue('trip') };
    const dispatch = {
      startAutomaticDispatch: jest.fn(async () => {
        calls.push('dispatch');
      }),
    };
    const notify = {
      notifyRequestStatus: jest.fn(async () => {
        calls.push('searching');
      }),
    };
    const service = new ApprovalsService(
      approvals as never,
      transaction as never,
      {} as never,
      dispatch as never,
      notify as never,
    );
    await service.approve('company', 'request', 'supervisor', {});
    expect(calls).toEqual(['searching', 'dispatch']);
  });
});
