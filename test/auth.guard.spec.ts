import { strict as assert } from 'node:assert';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { describe, it } from 'mocha';
import sinon from 'sinon';
import { ApiAuthGuard } from '../src/auth/auth.guard';

describe('ApiAuthGuard', () => {
  it('accepts the hardcoded demo bearer token', async () => {
    const reflector = new Reflector();
    const jwtService = { verifyAsync: sinon.stub() } as unknown as JwtService;
    const guard = new ApiAuthGuard(reflector, jwtService);
    const request = {
      headers: { authorization: 'Bearer demo-drive-token' },
    };

    const canActivate = await guard.canActivate(
      createExecutionContext(request),
    );

    assert.equal(canActivate, true);
    assert.deepEqual(request.user, {
      userId: 'demo-user',
      email: 'demo@example.com',
      isDemo: true,
    });
  });

  it('rejects requests without a bearer token', async () => {
    const reflector = new Reflector();
    const jwtService = { verifyAsync: sinon.stub() } as unknown as JwtService;
    const guard = new ApiAuthGuard(reflector, jwtService);

    await assert.rejects(
      () => guard.canActivate(createExecutionContext({ headers: {} })),
      UnauthorizedException,
    );
  });
});

function createExecutionContext(
  request: Record<string, unknown>,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
    getHandler: () => (() => undefined) as never,
    getClass: () => class TestClass {} as never,
  } as ExecutionContext;
}
