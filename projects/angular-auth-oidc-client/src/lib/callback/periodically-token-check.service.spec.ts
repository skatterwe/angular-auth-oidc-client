import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { mockProvider } from '../../test/auto-mock';
import { AuthStateService } from '../auth-state/auth-state.service';
import { ConfigurationService } from '../config/config.service';
import { OpenIdConfiguration } from '../config/openid-configuration';
import { CallbackContext } from '../flows/callback-context';
import { FlowsDataService } from '../flows/flows-data.service';
import { ResetAuthDataService } from '../flows/reset-auth-data.service';
import { RefreshSessionIframeService } from '../iframe/refresh-session-iframe.service';
import { LoggerService } from '../logging/logger.service';
import { EventTypes } from '../public-events/event-types';
import { PublicEventsService } from '../public-events/public-events.service';
import { StoragePersistenceService } from '../storage/storage-persistence.service';
import { UserService } from '../user-data/user.service';
import { FlowHelper } from '../utils/flowHelper/flow-helper.service';
import { IntervalService } from './interval.service';
import { PeriodicallyTokenCheckService } from './periodically-token-check.service';
import { RefreshSessionRefreshTokenService } from './refresh-session-refresh-token.service';

describe('PeriodicallyTokenCheckService', () => {
  let periodicallyTokenCheckService: PeriodicallyTokenCheckService;
  let intervalService: IntervalService;
  let flowsDataService: FlowsDataService;
  let flowHelper: FlowHelper;
  let authStateService: AuthStateService;
  let refreshSessionRefreshTokenService: RefreshSessionRefreshTokenService;
  let userService: UserService;
  let storagePersistenceService: StoragePersistenceService;
  let resetAuthDataService: ResetAuthDataService;
  let configurationService: ConfigurationService;
  let publicEventsService: PublicEventsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        mockProvider(ResetAuthDataService),
        FlowHelper,
        mockProvider(FlowsDataService),
        mockProvider(LoggerService),
        mockProvider(UserService),
        mockProvider(AuthStateService),
        mockProvider(RefreshSessionIframeService),
        mockProvider(RefreshSessionRefreshTokenService),
        mockProvider(IntervalService),
        mockProvider(StoragePersistenceService),
        mockProvider(PublicEventsService),
        mockProvider(ConfigurationService),
      ],
    });
  });

  beforeEach(() => {
    periodicallyTokenCheckService = TestBed.inject(
      PeriodicallyTokenCheckService
    );
    intervalService = TestBed.inject(IntervalService);
    flowsDataService = TestBed.inject(FlowsDataService);
    flowHelper = TestBed.inject(FlowHelper);
    authStateService = TestBed.inject(AuthStateService);
    refreshSessionRefreshTokenService = TestBed.inject(
      RefreshSessionRefreshTokenService
    );
    userService = TestBed.inject(UserService);
    storagePersistenceService = TestBed.inject(StoragePersistenceService);
    resetAuthDataService = TestBed.inject(ResetAuthDataService);
    publicEventsService = TestBed.inject(PublicEventsService);
    configurationService = TestBed.inject(ConfigurationService);

    spyOn(intervalService, 'startPeriodicTokenCheck').and.returnValue(of(null));
  });

  afterEach(() => {
    if (!!intervalService.runTokenValidationRunning?.unsubscribe) {
      intervalService.runTokenValidationRunning.unsubscribe();
      intervalService.runTokenValidationRunning = null;
    }
  });

  it('should create', () => {
    expect(periodicallyTokenCheckService).toBeTruthy();
  });

  describe('startTokenValidationPeriodically', () => {
    it('interval calls resetSilentRenewRunning when current flow is CodeFlowWithRefreshTokens', fakeAsync(() => {
      const configs = [
        { silentRenew: true, configId: 'configId1', tokenRefreshInSeconds: 1 },
      ];

      spyOn(
        periodicallyTokenCheckService as any,
        'shouldStartPeriodicallyCheckForConfig'
      ).and.returnValue(true);
      const isCurrentFlowCodeFlowWithRefreshTokensSpy = spyOn(
        flowHelper,
        'isCurrentFlowCodeFlowWithRefreshTokens'
      ).and.returnValue(true);
      const resetSilentRenewRunningSpy = spyOn(
        flowsDataService,
        'resetSilentRenewRunning'
      );

      spyOn(
        refreshSessionRefreshTokenService,
        'refreshSessionWithRefreshTokens'
      ).and.returnValue(of({} as CallbackContext));
      spyOn(configurationService, 'getOpenIDConfiguration').and.returnValue(
        of(configs[0])
      );

      periodicallyTokenCheckService.startTokenValidationPeriodically(
        configs,
        configs[0]
      );

      tick(1000);

      intervalService.runTokenValidationRunning?.unsubscribe();
      intervalService.runTokenValidationRunning = null;
      expect(isCurrentFlowCodeFlowWithRefreshTokensSpy).toHaveBeenCalled();
      expect(resetSilentRenewRunningSpy).toHaveBeenCalled();
    }));

    it('interval calls resetSilentRenewRunning in case of error when current flow is CodeFlowWithRefreshTokens', fakeAsync(() => {
      const configs = [
        { silentRenew: true, configId: 'configId1', tokenRefreshInSeconds: 1 },
      ];

      spyOn(
        periodicallyTokenCheckService as any,
        'shouldStartPeriodicallyCheckForConfig'
      ).and.returnValue(true);
      const resetSilentRenewRunning = spyOn(
        flowsDataService,
        'resetSilentRenewRunning'
      );

      spyOn(
        flowHelper,
        'isCurrentFlowCodeFlowWithRefreshTokens'
      ).and.returnValue(true);
      spyOn(
        refreshSessionRefreshTokenService,
        'refreshSessionWithRefreshTokens'
      ).and.returnValue(throwError(() => new Error('error')));
      spyOn(configurationService, 'getOpenIDConfiguration').and.returnValue(
        of(configs[0])
      );

      periodicallyTokenCheckService.startTokenValidationPeriodically(
        configs,
        configs[0]
      );

      tick(1000);

      expect(
        periodicallyTokenCheckService.startTokenValidationPeriodically
      ).toThrowError();
      expect(resetSilentRenewRunning).toHaveBeenCalledOnceWith(configs[0]);
    }));

    it('interval throws silent renew failed event with data in case of an error', fakeAsync(() => {
      const configs = [
        { silentRenew: true, configId: 'configId1', tokenRefreshInSeconds: 1 },
      ];

      spyOn(
        periodicallyTokenCheckService as any,
        'shouldStartPeriodicallyCheckForConfig'
      ).and.returnValue(true);
      spyOn(flowsDataService, 'resetSilentRenewRunning');
      const publicEventsServiceSpy = spyOn(publicEventsService, 'fireEvent');

      spyOn(
        flowHelper,
        'isCurrentFlowCodeFlowWithRefreshTokens'
      ).and.returnValue(true);
      spyOn(
        refreshSessionRefreshTokenService,
        'refreshSessionWithRefreshTokens'
      ).and.returnValue(throwError(() => new Error('error')));
      spyOn(configurationService, 'getOpenIDConfiguration').and.returnValue(
        of(configs[0])
      );

      periodicallyTokenCheckService.startTokenValidationPeriodically(
        configs,
        configs[0]
      );

      tick(1000);

      expect(
        periodicallyTokenCheckService.startTokenValidationPeriodically
      ).toThrowError();
      expect(publicEventsServiceSpy.calls.allArgs()).toEqual([
        [EventTypes.SilentRenewStarted],
        [EventTypes.SilentRenewFailed, new Error('error')],
      ]);
    }));

    it('calls resetAuthorizationData and returns if no silent renew is configured', fakeAsync(() => {
      const configs = [
        { silentRenew: true, configId: 'configId1', tokenRefreshInSeconds: 1 },
      ];

      spyOn(
        periodicallyTokenCheckService as any,
        'shouldStartPeriodicallyCheckForConfig'
      ).and.returnValue(true);

      const configSpy = spyOn(configurationService, 'getOpenIDConfiguration');
      const configWithoutSilentRenew = {
        silentRenew: false,
        configId: 'configId1',
        tokenRefreshInSeconds: 1,
      };
      const configWithoutSilentRenew$ = of(configWithoutSilentRenew);

      configSpy.and.returnValue(configWithoutSilentRenew$);

      const resetAuthorizationDataSpy = spyOn(
        resetAuthDataService,
        'resetAuthorizationData'
      );

      periodicallyTokenCheckService.startTokenValidationPeriodically(
        configs,
        configs[0]
      );
      tick(1000);
      intervalService.runTokenValidationRunning?.unsubscribe();
      intervalService.runTokenValidationRunning = null;

      expect(resetAuthorizationDataSpy).toHaveBeenCalledTimes(1);
      expect(resetAuthorizationDataSpy).toHaveBeenCalledOnceWith(
        configWithoutSilentRenew,
        configs
      );
    }));

    it('calls refreshSessionWithRefreshTokens if current flow is Code flow with refresh tokens', fakeAsync(() => {
      spyOn(
        flowHelper,
        'isCurrentFlowCodeFlowWithRefreshTokens'
      ).and.returnValue(true);
      spyOn(
        periodicallyTokenCheckService as any,
        'shouldStartPeriodicallyCheckForConfig'
      ).and.returnValue(true);
      spyOn(storagePersistenceService, 'read').and.returnValue({});
      const configs = [
        { configId: 'configId1', silentRenew: true, tokenRefreshInSeconds: 1 },
      ];

      spyOn(configurationService, 'getOpenIDConfiguration').and.returnValue(
        of(configs[0] as OpenIdConfiguration)
      );
      const refreshSessionWithRefreshTokensSpy = spyOn(
        refreshSessionRefreshTokenService,
        'refreshSessionWithRefreshTokens'
      ).and.returnValue(of({} as CallbackContext));

      periodicallyTokenCheckService.startTokenValidationPeriodically(
        configs,
        configs[0]
      );

      tick(1000);

      intervalService.runTokenValidationRunning?.unsubscribe();
      intervalService.runTokenValidationRunning = null;
      expect(refreshSessionWithRefreshTokensSpy).toHaveBeenCalled();
    }));
  });

  describe('shouldStartPeriodicallyCheckForConfig', () => {
    it('returns false when there is no IdToken', () => {
      spyOn(authStateService, 'getIdToken').and.returnValue('');
      spyOn(flowsDataService, 'isSilentRenewRunning').and.returnValue(false);
      spyOn(userService, 'getUserDataFromStore').and.returnValue(
        'some-userdata'
      );

      const result = (
        periodicallyTokenCheckService as any
      ).shouldStartPeriodicallyCheckForConfig({ configId: 'configId1' });

      expect(result).toBeFalse();
    });

    it('returns false when silent renew is running', () => {
      spyOn(authStateService, 'getIdToken').and.returnValue('idToken');
      spyOn(flowsDataService, 'isSilentRenewRunning').and.returnValue(true);
      spyOn(userService, 'getUserDataFromStore').and.returnValue(
        'some-userdata'
      );

      const result = (
        periodicallyTokenCheckService as any
      ).shouldStartPeriodicallyCheckForConfig({ configId: 'configId1' });

      expect(result).toBeFalse();
    });

    it('returns false when code flow is in progress', () => {
      spyOn(authStateService, 'getIdToken').and.returnValue('idToken');
      spyOn(flowsDataService, 'isSilentRenewRunning').and.returnValue(false);
      spyOn(flowsDataService, 'isCodeFlowInProgress').and.returnValue(true);
      spyOn(userService, 'getUserDataFromStore').and.returnValue(
        'some-userdata'
      );

      const result = (
        periodicallyTokenCheckService as any
      ).shouldStartPeriodicallyCheckForConfig({ configId: 'configId1' });

      expect(result).toBeFalse();
    });

    it('returns false when there is no userdata from the store', () => {
      spyOn(authStateService, 'getIdToken').and.returnValue('idToken');
      spyOn(flowsDataService, 'isSilentRenewRunning').and.returnValue(true);
      spyOn(userService, 'getUserDataFromStore').and.returnValue(null);

      const result = (
        periodicallyTokenCheckService as any
      ).shouldStartPeriodicallyCheckForConfig({ configId: 'configId1' });

      expect(result).toBeFalse();
    });

    it('returns true when there is userDataFromStore, silentrenew is not running and there is an idtoken', () => {
      spyOn(authStateService, 'getIdToken').and.returnValue('idToken');
      spyOn(flowsDataService, 'isSilentRenewRunning').and.returnValue(false);
      spyOn(userService, 'getUserDataFromStore').and.returnValue(
        'some-userdata'
      );

      spyOn(
        authStateService,
        'hasIdTokenExpiredAndRenewCheckIsEnabled'
      ).and.returnValue(true);
      spyOn(
        authStateService,
        'hasAccessTokenExpiredIfExpiryExists'
      ).and.returnValue(true);

      const result = (
        periodicallyTokenCheckService as any
      ).shouldStartPeriodicallyCheckForConfig({ configId: 'configId1' });

      expect(result).toBeTrue();
    });

    it('returns false if tokens are not expired', () => {
      spyOn(authStateService, 'getIdToken').and.returnValue('idToken');
      spyOn(flowsDataService, 'isSilentRenewRunning').and.returnValue(false);
      spyOn(userService, 'getUserDataFromStore').and.returnValue(
        'some-userdata'
      );
      spyOn(
        authStateService,
        'hasIdTokenExpiredAndRenewCheckIsEnabled'
      ).and.returnValue(false);
      spyOn(
        authStateService,
        'hasAccessTokenExpiredIfExpiryExists'
      ).and.returnValue(false);

      const result = (
        periodicallyTokenCheckService as any
      ).shouldStartPeriodicallyCheckForConfig({ configId: 'configId1' });

      expect(result).toBeFalse();
    });

    it('returns true if tokens are  expired', () => {
      spyOn(authStateService, 'getIdToken').and.returnValue('idToken');
      spyOn(flowsDataService, 'isSilentRenewRunning').and.returnValue(false);
      spyOn(userService, 'getUserDataFromStore').and.returnValue(
        'some-userdata'
      );

      spyOn(
        authStateService,
        'hasIdTokenExpiredAndRenewCheckIsEnabled'
      ).and.returnValue(true);
      spyOn(
        authStateService,
        'hasAccessTokenExpiredIfExpiryExists'
      ).and.returnValue(true);

      const result = (
        periodicallyTokenCheckService as any
      ).shouldStartPeriodicallyCheckForConfig({ configId: 'configId1' });

      expect(result).toBeTrue();
    });
  });
});
