import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  StatusBar,
  Platform,
  BackHandler,
  ActivityIndicator,
  Text,
  SafeAreaView,
  AppState,
  AppStateStatus,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Asset } from 'expo-asset';
import * as SplashScreen from 'expo-splash-screen';
import {
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
  AppOpenAd,
  AdEventType,
  TestIds,
  MobileAds,
} from 'react-native-google-mobile-ads';

SplashScreen.preventAutoHideAsync().catch(() => {});

// ========== Ad Unit IDs (Test IDs in __DEV__) ==========
const BANNER_ID = __DEV__ ? TestIds.BANNER : 'ca-app-pub-xxxxxxxx/BANNER';
const INTERSTITIAL_ID = __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-xxxxxxxx/INTER';
const REWARDED_ID = __DEV__ ? TestIds.REWARDED : 'ca-app-pub-xxxxxxxx/REWARDED';
const APP_OPEN_ID = __DEV__ ? TestIds.APP_OPEN : 'ca-app-pub-xxxxxxxx/APPOPEN';

// Create ad instances
const interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_ID, {
  requestNonPersonalizedAdsOnly: true,
});
const rewarded = RewardedAd.createForAdRequest(REWARDED_ID, {
  requestNonPersonalizedAdsOnly: true,
});
const appOpenAd = AppOpenAd.createForAdRequest(APP_OPEN_ID, {
  requestNonPersonalizedAdsOnly: true,
});

export default function App() {
  const webRef = useRef<WebView>(null);
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [rewardedReady, setRewardedReady] = useState(false);
  const [interReady, setInterReady] = useState(false);
  const [appOpenReady, setAppOpenReady] = useState(false);
  const toolOpenCount = useRef(0);
  const appState = useRef(AppState.currentState);
  const hasShownAppOpen = useRef(false);
  const pendingExportResolve = useRef<(() => void) | null>(null);

  // ---------- Load HTML + Init Ads ----------
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await MobileAds().initialize();
        const asset = Asset.fromModule(require('./assets/index.html'));
        await asset.downloadAsync();
        if (mounted) setHtmlUri(asset.localUri || asset.uri);
      } catch (e) {
        console.warn('Init error', e);
        if (mounted) setHtmlUri(null);
      } finally {
        if (mounted) setAppReady(true);
      }
    })();

    // Rewarded listeners
    const rLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setRewardedReady(true);
    });
    const rEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      // user watched the ad
    });
    const rClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      setRewardedReady(false);
      rewarded.load();
      if (pendingExportResolve.current) {
        const resolve = pendingExportResolve.current;
        pendingExportResolve.current = null;
        resolve();
      }
    });
    const rError = rewarded.addAdEventListener(AdEventType.ERROR, () => {
      setRewardedReady(false);
      if (pendingExportResolve.current) {
        const resolve = pendingExportResolve.current;
        pendingExportResolve.current = null;
        resolve();
      }
    });

    // Interstitial listeners
    const iLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => setInterReady(true));
    const iClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      setInterReady(false);
      interstitial.load();
    });
    const iError = interstitial.addAdEventListener(AdEventType.ERROR, () => setInterReady(false));

    // App Open listeners
    const aLoaded = appOpenAd.addAdEventListener(AdEventType.LOADED, () => setAppOpenReady(true));
    const aClosed = appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
      setAppOpenReady(false);
      appOpenAd.load();
    });
    const aError = appOpenAd.addAdEventListener(AdEventType.ERROR, () => setAppOpenReady(false));

    // Preload all
    rewarded.load();
    interstitial.load();
    appOpenAd.load();

    return () => {
      mounted = false;
      rLoaded(); rEarned(); rClosed(); rError();
      iLoaded(); iClosed(); iError();
      aLoaded(); aClosed(); aError();
    };
  }, []);

  // ---------- App Open Ad (every cold / warm start) ----------
  useEffect(() => {
    const handleAppState = (next: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        next === 'active' &&
        appOpenReady &&
        !hasShownAppOpen.current
      ) {
        hasShownAppOpen.current = true;
        appOpenAd.show().catch(() => {});
        setTimeout(() => {
          hasShownAppOpen.current = false;
        }, 60_000);
      }
      appState.current = next;
    };

    const sub = AppState.addEventListener('change', handleAppState);

    if (appReady && appOpenReady && !hasShownAppOpen.current) {
      hasShownAppOpen.current = true;
      setTimeout(() => {
        appOpenAd.show().catch(() => {});
        setTimeout(() => {
          hasShownAppOpen.current = false;
        }, 60_000);
      }, 800);
    }

    return () => sub.remove();
  }, [appReady, appOpenReady]);

  const onLayoutRootView = useCallback(async () => {
    if (appReady) await SplashScreen.hideAsync();
  }, [appReady]);

  useEffect(() => {
    const onBack = () => {
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [canGoBack]);

  const showTwoRewardedThenContinue = useCallback(async () => {
    const showOne = () =>
      new Promise<void>((resolve) => {
        if (!rewardedReady) {
          resolve();
          return;
        }
        pendingExportResolve.current = resolve;
        rewarded.show().catch(() => resolve());
      });

    await showOne();
    await new Promise((r) => setTimeout(r, 400));
    await showOne();
  }, [rewardedReady]);

  const onMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data?.type === 'EXPORT_CLICK' || data?.type === 'DOWNLOAD_CLICK') {
          await showTwoRewardedThenContinue();
          webRef.current?.injectJavaScript(`
            window.__gmaxExportUnlocked = true;
            window.dispatchEvent(new Event('gmax-export-ready'));
            true;
          `);
        }
      } catch (_) {}
    },
    [showTwoRewardedThenContinue]
  );

  const injectedJS = `
    (function() {
      if (window.__gmaxAdBridge) return;
      window.__gmaxAdBridge = true;

      function notifyExport() {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: 'EXPORT_CLICK' })
        );
      }

      const origCreate = URL.createObjectURL;
      URL.createObjectURL = function(blob) {
        notifyExport();
        return origCreate.call(this, blob);
      };

      document.addEventListener('click', function(e) {
        const t = e.target;
        if (!t) return;
        const txt = (t.innerText || t.textContent || t.value || t.title || t.getAttribute('aria-label') || '').toLowerCase();
        const id = (t.id || '').toLowerCase();
        const cls = (t.className || '').toString().toLowerCase();
        if (
          /export|download|save|download png|download jpg|download pdf|save new|download zip|download video|apply edits|compress|convert & download|make it exactly|download jpg|download png/.test(txt) ||
          /export|download|save|dl-/.test(id) ||
          /btn.*download|download.*btn/.test(cls)
        ) {
          notifyExport();
        }
      }, true);

      true;
    })();
  `;

  const handleNavChange = (navState: any) => {
    setCanGoBack(navState.canGoBack);
    if (navState.url && (navState.url.includes('#') || navState.url.includes('tool'))) {
      toolOpenCount.current += 1;
      if (toolOpenCount.current % 5 === 0 && interReady) {
        interstitial.show().catch(() => {});
      }
    }
  };

  if (!appReady) {
    return (
      <View style={styles.center} onLayout={onLayoutRootView}>
        <StatusBar barStyle="light-content" backgroundColor="#0b0d11" />
        <ActivityIndicator size="large" color="#f2a93b" />
        <Text style={styles.loadingText}>GMAX Tools</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} onLayout={onLayoutRootView}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0d11" />

      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={
          htmlUri
            ? { uri: htmlUri }
            : {
                html: `<!DOCTYPE html><html><body style="background:#0b0d11;color:#fff;display:grid;place-items:center;height:100vh;font-family:system-ui"><h1>GMAX Tools</h1></body></html>`,
              }
        }
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        setSupportMultipleWindows={false}
        onNavigationStateChange={handleNavChange}
        onMessage={onMessage}
        injectedJavaScript={injectedJS}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#f2a93b" />
          </View>
        )}
      />

      <View style={styles.bannerWrap}>
        <BannerAd
          unitId={BANNER_ID}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdFailedToLoad={(e) => console.log('Banner fail', e)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0d11',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0b0d11',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0b0d11',
  },
  loadingText: {
    marginTop: 14,
    color: '#f2a93b',
    fontSize: 18,
    fontWeight: '600',
  },
  bannerWrap: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#0b0d11',
    paddingBottom: Platform.OS === 'android' ? 4 : 0,
  },
});
