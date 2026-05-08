import { useEffect, useMemo, useRef, useState } from "react";
import * as AuthSession from "expo-auth-session";
import * as ImagePicker from "expo-image-picker";
import {
  t,
  type Comment,
  type CommentCreateSyncPayload,
  type Consignation,
  type ConsignationPrepareSyncPayload,
  type ConsignationSendSyncPayload,
  type EvidenceBootstrap,
  type EvidencePhoto,
  type EvidenceType,
  type MediaAsset,
  type Observation,
  type ObservationCreateSyncPayload,
  type PhotoUploadSyncPayload,
  type PrepareConsignationInput,
  type SyncOperation,
  type Task,
  type UploadCapturedEvidenceInput,
  type UploadStatus,
  type Visit,
  type VisitCheckInSyncPayload,
  type VisitCheckOutSyncPayload
} from "@capris/shared";
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  API_BASE_URL,
  GOOGLE_CLIENT_ID,
  authenticatedMobileFetch,
  createGoogleAuthConfig,
  exchangeGoogleIdToken,
  googleDiscovery,
  loadStoredMobileSession,
  signOutMobileSession,
  type StoredMobileSession
} from "./auth-session";
import {
  enqueueSyncOperation,
  clearAuthSession,
  initializeOfflineStore,
  loadCachedBootstrap,
  loadSyncOperations,
  removeSyncOperation,
  saveBootstrapCache,
  updateSyncOperation
} from "./offline-store";
const FALLBACK_LATITUDE = 9.9186;
const FALLBACK_LONGITUDE = -84.1397;
const FIELD_USER_ID = "user_field_001";
const ORGANIZATION_ID = "org_capris";
const AUTO_SYNC_INTERVAL_MS = 15000;

const fallbackTasks: Task[] = [
  {
    id: "task_launch_display",
    organizationId: ORGANIZATION_ID,
    title: "Install launch display at Escazu Plaza",
    requesterId: "user_admin_001",
    assigneeId: FIELD_USER_ID,
    scheduledFor: "2026-05-08",
    provinceId: "province_san_jose",
    zoneId: "zone_central",
    clientId: "client_auto_mercado",
    pointOfSaleId: "pos_escazu_001",
    activityTypeId: "activity_consignation",
    taskTypeId: "task_visit",
    status: "pending",
    priority: "high",
    difficulty: "standard"
  }
];

const fallbackVisits: Visit[] = [
  {
    id: "visit_launch_display",
    organizationId: ORGANIZATION_ID,
    taskId: "task_launch_display",
    assigneeId: FIELD_USER_ID,
    scheduledFor: "2026-05-08",
    provinceId: "province_san_jose",
    zoneId: "zone_central",
    pointOfSaleId: "pos_escazu_001",
    status: "scheduled"
  }
];

export default function App() {
  const [request, response, promptAsync] = AuthSession.useAuthRequest(createGoogleAuthConfig(), googleDiscovery);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [mobileSession, setMobileSession] = useState<StoredMobileSession | null>(null);
  const [bootstrap, setBootstrap] = useState<EvidenceBootstrap | null>(null);
  const [captureBusyKey, setCaptureBusyKey] = useState<string | null>(null);
  const [localSyncOperations, setLocalSyncOperations] = useState<SyncOperation[]>([]);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const autoSyncEnabledRef = useRef(true);
  const effectiveUserId = mobileSession?.profile?.user.id ?? FIELD_USER_ID;

  const tasks = bootstrap?.tasks.length ? bootstrap.tasks : fallbackTasks;
  const visits = bootstrap?.visits.length ? bootstrap.visits : fallbackVisits;
  const evidence = bootstrap?.evidence ?? [];
  const mediaAssets = bootstrap?.mediaAssets ?? [];
  const comments = bootstrap?.comments ?? [];
  const observations = bootstrap?.observations ?? [];
  const consignations = bootstrap?.consignations ?? [];
  const pointsOfSale = bootstrap?.pointsOfSale ?? [];
  const requirementSummaries = bootstrap?.requirementSummaries ?? [];
  const pendingSyncOperations = localSyncOperations.length ? localSyncOperations : bootstrap?.pendingSyncOperations ?? [];

  useEffect(() => {
    void initializeApp();
  }, []);

  useEffect(() => {
    if (response?.type !== "success") {
      return;
    }

    const idToken = response.params.id_token;
    if (!idToken) {
      setError("Google sign-in did not return an ID token.");
      return;
    }

    void completeGoogleSignIn(idToken);
  }, [response]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (autoSyncEnabledRef.current && pendingSyncOperations.length > 0 && !syncingQueue) {
        void syncQueuedOperationsNow("background");
      }
    }, AUTO_SYNC_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [pendingSyncOperations.length, syncingQueue]);

  const visibleTasks = useMemo(() => tasks.filter((task) => task.assigneeId === effectiveUserId), [effectiveUserId, tasks]);
  const visibleVisits = useMemo(() => visits.filter((visit) => visit.assigneeId === effectiveUserId), [effectiveUserId, visits]);

  async function initializeApp() {
    try {
      await initializeOfflineStore();
      const [cachedBootstrap, storedOperations, storedSession] = await Promise.all([
        loadCachedBootstrap(),
        loadSyncOperations(),
        loadStoredMobileSession()
      ]);
      setMobileSession(storedSession);
      setLocalSyncOperations(storedOperations);
      setBootstrap(applyPendingOperationsToBootstrap(cachedBootstrap ?? createFallbackBootstrap(), storedOperations));
      if (storedSession) {
        await loadRouteDay();
      } else {
        setStatusMessage("Sign in with Google to sync live route data.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function completeGoogleSignIn(idToken: string) {
    try {
      setAuthBusy(true);
      setError(null);
      const session = await exchangeGoogleIdToken(idToken);
      setMobileSession(session);
      setStatusMessage("Signed in on mobile.");
      await loadRouteDay();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Unable to sign in on mobile.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function startGoogleSignIn() {
    if (!GOOGLE_CLIENT_ID || !request) {
      setError("Google sign-in is not configured for this mobile environment.");
      return;
    }

    setAuthBusy(true);
    setError(null);
    try {
      await promptAsync();
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    await signOutMobileSession(mobileSession?.refreshToken);
    await clearAuthSession();
    setMobileSession(null);
    setStatusMessage("Signed out on mobile.");
  }

  async function persistBootstrap(nextBootstrap: EvidenceBootstrap) {
    setBootstrap(nextBootstrap);
    await saveBootstrapCache(nextBootstrap);
  }

  async function refreshQueuedOperations() {
    const operations = await loadSyncOperations();
    setLocalSyncOperations(operations);
    return operations;
  }

  async function loadRouteDay() {
    const storedOperations = await refreshQueuedOperations();

    try {
      setLoading(true);
      setError(null);
      const response = await authenticatedMobileFetch(`${API_BASE_URL}/evidence/bootstrap`);
      if (!response.ok) {
        throw new Error(`Evidence bootstrap failed with status ${response.status}.`);
      }

      const payload = (await response.json()) as EvidenceBootstrap;
      await persistBootstrap(applyPendingOperationsToBootstrap(payload, storedOperations));
    } catch (loadError) {
      const cached = (await loadCachedBootstrap()) ?? createFallbackBootstrap();
      await persistBootstrap(applyPendingOperationsToBootstrap(cached, storedOperations));
      setError(loadError instanceof Error ? `${loadError.message} Using offline cache.` : "Unable to load route day. Using offline cache.");
    } finally {
      setLoading(false);
    }
  }

  async function queueOperation(operation: SyncOperation, successMessage: string) {
    await enqueueSyncOperation(operation);
    const nextOperations = [...localSyncOperations, operation];
    setLocalSyncOperations(nextOperations);
    await persistBootstrap(applyPendingOperationsToBootstrap(bootstrap ?? createFallbackBootstrap(), nextOperations));
    setStatusMessage(successMessage);
  }

  async function transitionVisit(visit: Visit, action: "check_in" | "check_out") {
    const linkedPointOfSale = pointsOfSale.find((pointOfSale) => pointOfSale.id === visit.pointOfSaleId);
    const latitude = linkedPointOfSale?.latitude ?? FALLBACK_LATITUDE;
    const longitude = linkedPointOfSale?.longitude ?? FALLBACK_LONGITUDE;
    const endpoint = action === "check_in" ? "check-in" : "check-out";
    const payload =
      action === "check_in"
        ? ({
            visitId: visit.id,
            checkedInAt: new Date().toISOString(),
            checkedInLatitude: latitude,
            checkedInLongitude: longitude
          } satisfies VisitCheckInSyncPayload)
        : ({
            visitId: visit.id,
            checkedOutAt: new Date().toISOString(),
            checkedOutLatitude: latitude,
            checkedOutLongitude: longitude
          } satisfies VisitCheckOutSyncPayload);

    try {
      await syncJsonRequest(`${API_BASE_URL}/visits/${visit.id}/${endpoint}`, "PATCH", payload);
      setStatusMessage(action === "check_in" ? "Visit checked in." : "Visit checked out.");
      await loadRouteDay();
    } catch {
      await queueOperation(
        {
          id: `sync_${action}_${visit.id}_${Date.now()}`,
          type: action === "check_in" ? "visit_check_in" : "visit_check_out",
          state: "pending_sync",
          payload,
          retryCount: 0,
          createdAt: new Date().toISOString()
        },
        action === "check_in" ? "Visit check-in queued for sync." : "Visit check-out queued for sync."
      );
    }
  }

  async function captureEvidence(taskId: string, visitId: string | undefined, type: EvidenceType, source: "camera" | "library") {
    const busyKey = `${taskId}:${type}:${source}`;
    try {
      setCaptureBusyKey(busyKey);
      setStatusMessage(null);
      setError(null);

      const permission =
        source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", source === "camera" ? "Camera permission is required." : "Photo library permission is required.");
        return;
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({ allowsEditing: false, base64: true, mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({
              allowsEditing: false,
              base64: true,
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.7
            });

      if (result.canceled || !result.assets[0]?.base64) {
        return;
      }

      const asset = result.assets[0];
      const fileBase64 = asset.base64;
      if (!fileBase64) {
        throw new Error("Selected image is missing base64 data.");
      }
      const uploadRequest: UploadCapturedEvidenceInput = {
        organizationId: ORGANIZATION_ID,
        taskId,
        visitId,
        uploaderUserId: effectiveUserId,
        type,
        capturedAt: new Date().toISOString(),
        latitude: FALLBACK_LATITUDE,
        longitude: FALLBACK_LONGITUDE,
        fileName: asset.fileName ?? `${taskId}-${type}-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? "image/jpeg",
        fileBase64,
        captureSource: source,
        byteSize: asset.fileSize,
        width: asset.width,
        height: asset.height
      };

      try {
        await syncJsonRequest(`${API_BASE_URL}/evidence/upload`, "POST", uploadRequest);
        setStatusMessage(`${t("en", `evidence.type.${type}` as never)} uploaded from ${source}.`);
        await loadRouteDay();
      } catch {
        const localMediaAssetId = `media_local_${Date.now()}`;
        const localEvidenceId = `evidence_local_${Date.now()}`;
        await queueOperation(
          {
            id: `sync_photo_upload_${Date.now()}`,
            type: "photo_upload",
            state: "pending_sync",
            payload: {
              uploadRequest,
              localEvidenceId,
              localMediaAssetId
            } satisfies PhotoUploadSyncPayload,
            retryCount: 0,
            createdAt: uploadRequest.capturedAt
          },
          `${t("en", `evidence.type.${type}` as never)} queued for offline upload.`
        );
      }
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "Unable to capture evidence.");
    } finally {
      setCaptureBusyKey(null);
    }
  }

  async function addQuickComment(taskId: string) {
    const payload: CommentCreateSyncPayload = {
      organizationId: ORGANIZATION_ID,
      taskId,
      userId: effectiveUserId,
      body: `Field comment at ${new Date().toLocaleTimeString("en-US")}`,
      createdAt: new Date().toISOString()
    };

    try {
      await syncJsonRequest(`${API_BASE_URL}/notes/comments`, "POST", payload);
      setStatusMessage("Comment saved.");
      await loadRouteDay();
    } catch {
      await queueOperation(
        {
          id: `sync_comment_${Date.now()}`,
          type: "comment_create",
          state: "pending_sync",
          payload,
          retryCount: 0,
          createdAt: payload.createdAt
        },
        "Comment queued for sync."
      );
    }
  }

  async function addQuickObservation(taskId: string) {
    const payload: ObservationCreateSyncPayload = {
      organizationId: ORGANIZATION_ID,
      taskId,
      userId: effectiveUserId,
      body: `Field observation at ${new Date().toLocaleTimeString("en-US")}`,
      createdAt: new Date().toISOString()
    };

    try {
      await syncJsonRequest(`${API_BASE_URL}/notes/observations`, "POST", payload);
      setStatusMessage("Observation saved.");
      await loadRouteDay();
    } catch {
      await queueOperation(
        {
          id: `sync_observation_${Date.now()}`,
          type: "observation_create",
          state: "pending_sync",
          payload,
          retryCount: 0,
          createdAt: payload.createdAt
        },
        "Observation queued for sync."
      );
    }
  }

  async function prepareConsignation(taskId: string, visitId?: string) {
    const localConsignationId = `consignation_local_${Date.now()}`;
    const payload: ConsignationPrepareSyncPayload = {
      localConsignationId,
      organizationId: ORGANIZATION_ID,
      taskId,
      userId: effectiveUserId,
      visitId,
      note: "Prepared in field workflow.",
      preparedAt: new Date().toISOString()
    };

    try {
      await syncJsonRequest(`${API_BASE_URL}/consignations/prepare`, "POST", {
        organizationId: payload.organizationId,
        taskId: payload.taskId,
        userId: payload.userId,
        visitId: payload.visitId,
        note: payload.note,
        preparedAt: payload.preparedAt
      } satisfies PrepareConsignationInput);
      setStatusMessage("Consignation prepared.");
      await loadRouteDay();
    } catch {
      await queueOperation(
        {
          id: `sync_consignation_prepare_${Date.now()}`,
          type: "consignation_prepare",
          state: "pending_sync",
          payload,
          retryCount: 0,
          createdAt: payload.preparedAt
        },
        "Consignation preparation queued for sync."
      );
    }
  }

  async function sendConsignation(consignation: Consignation) {
    const payload: ConsignationSendSyncPayload = {
      consignationId: consignation.id,
      localConsignationId: consignation.id.startsWith("consignation_local_") ? consignation.id : undefined,
      sentAt: new Date().toISOString()
    };

    try {
      await syncJsonRequest(`${API_BASE_URL}/consignations/${consignation.id}/send`, "PATCH", { sentAt: payload.sentAt });
      setStatusMessage("Consignation marked as sent.");
      await loadRouteDay();
    } catch {
      await queueOperation(
        {
          id: `sync_consignation_send_${Date.now()}`,
          type: "consignation_send",
          state: "pending_sync",
          payload,
          retryCount: 0,
          createdAt: payload.sentAt
        },
        "Consignation send queued for sync."
      );
    }
  }

  async function updateMediaUpload(mediaAsset: MediaAsset, nextStatus: UploadStatus) {
    const queueOperation = findQueuedPhotoOperation(localSyncOperations, mediaAsset.id);
    if (queueOperation) {
      const nextState = nextStatus === "failed" ? "sync_failed" : "pending_sync";
      const updatedOperation: SyncOperation = {
        ...queueOperation,
        state: nextState,
        retryCount: nextStatus === "failed" ? queueOperation.retryCount + 1 : queueOperation.retryCount,
        errorMessage: nextStatus === "failed" ? "Upload interrupted while offline." : undefined
      };
      await updateSyncOperation(updatedOperation);
      const nextOperations = localSyncOperations.map((operation) => (operation.id === queueOperation.id ? updatedOperation : operation));
      setLocalSyncOperations(nextOperations);
      await persistBootstrap(applyPendingOperationsToBootstrap(bootstrap ?? createFallbackBootstrap(), nextOperations));
      setStatusMessage(`${mediaAsset.fileName} updated locally to ${nextStatus}.`);
      return;
    }

    try {
      await syncJsonRequest(`${API_BASE_URL}/evidence/media/${mediaAsset.id}/upload-status`, "PATCH", buildUploadStatusPayload(mediaAsset, nextStatus));
      setStatusMessage(`${mediaAsset.fileName} moved to ${nextStatus}.`);
      await loadRouteDay();
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : "Unable to update upload.");
    }
  }

  async function requestRetry(mediaAsset: MediaAsset) {
    const queueOperation = findQueuedPhotoOperation(localSyncOperations, mediaAsset.id);
    if (queueOperation) {
      const updatedOperation: SyncOperation = {
        ...queueOperation,
        state: "pending_sync",
        retryCount: queueOperation.retryCount + 1,
        errorMessage: undefined
      };
      await updateSyncOperation(updatedOperation);
      const nextOperations = localSyncOperations.map((operation) => (operation.id === queueOperation.id ? updatedOperation : operation));
      setLocalSyncOperations(nextOperations);
      await persistBootstrap(applyPendingOperationsToBootstrap(bootstrap ?? createFallbackBootstrap(), nextOperations));
      setStatusMessage(`Retry queued for ${mediaAsset.fileName}.`);
      return;
    }

    try {
      await syncJsonRequest(`${API_BASE_URL}/evidence/media/${mediaAsset.id}/retry`, "POST", {
        reason: "Mobile retry requested after offline interruption",
        chunkCount: mediaAsset.chunkCount ?? 4
      });
      setStatusMessage(`Retry queued for ${mediaAsset.fileName}.`);
      await loadRouteDay();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Unable to request retry.");
    }
  }

  async function syncQueuedOperationsNow(mode: "manual" | "background" = "manual") {
    if (syncingQueue) {
      return;
    }

    setSyncingQueue(true);
    if (mode === "manual") {
      setStatusMessage(null);
      setError(null);
    }

    try {
      let currentOperations = await loadSyncOperations();
      const localConsignationIdMap = new Map<string, string>();

      for (const operation of currentOperations) {
        try {
          if (operation.type === "visit_check_in") {
            const payload = operation.payload as VisitCheckInSyncPayload;
            await syncJsonRequest(`${API_BASE_URL}/visits/${payload.visitId}/check-in`, "PATCH", payload);
          } else if (operation.type === "visit_check_out") {
            const payload = operation.payload as VisitCheckOutSyncPayload;
            await syncJsonRequest(`${API_BASE_URL}/visits/${payload.visitId}/check-out`, "PATCH", payload);
          } else if (operation.type === "photo_upload") {
            const payload = operation.payload as PhotoUploadSyncPayload;
            await syncJsonRequest(`${API_BASE_URL}/evidence/upload`, "POST", payload.uploadRequest);
          } else if (operation.type === "comment_create") {
            await syncJsonRequest(`${API_BASE_URL}/notes/comments`, "POST", operation.payload);
          } else if (operation.type === "observation_create") {
            await syncJsonRequest(`${API_BASE_URL}/notes/observations`, "POST", operation.payload);
          } else if (operation.type === "consignation_prepare") {
            const payload = operation.payload as ConsignationPrepareSyncPayload;
            const result = await syncJsonRequest(`${API_BASE_URL}/consignations/prepare`, "POST", {
              organizationId: payload.organizationId,
              taskId: payload.taskId,
              userId: payload.userId,
              visitId: payload.visitId,
              note: payload.note,
              preparedAt: payload.preparedAt
            });
            localConsignationIdMap.set(payload.localConsignationId, result?.item?.id ?? payload.localConsignationId);
          } else if (operation.type === "consignation_send") {
            const payload = operation.payload as ConsignationSendSyncPayload;
            const resolvedId = payload.localConsignationId ? localConsignationIdMap.get(payload.localConsignationId) ?? payload.localConsignationId : payload.consignationId;
            await syncJsonRequest(`${API_BASE_URL}/consignations/${resolvedId}/send`, "PATCH", { sentAt: payload.sentAt });
          }

          await removeSyncOperation(operation.id);
          currentOperations = currentOperations.filter((item) => item.id !== operation.id);
        } catch (syncError) {
          const failedOperation: SyncOperation = {
            ...operation,
            state: "sync_failed",
            retryCount: operation.retryCount + 1,
            lastAttemptAt: new Date().toISOString(),
            errorMessage: syncError instanceof Error ? syncError.message : "Sync attempt failed."
          };
          await updateSyncOperation(failedOperation);
          currentOperations = currentOperations.map((item) => (item.id === operation.id ? failedOperation : item));
        }
      }

      setLocalSyncOperations(currentOperations);
      if (mode === "manual" || currentOperations.length === 0) {
        setStatusMessage(currentOperations.length === 0 ? "Queued offline actions synced." : "Some actions still need another retry.");
      }
      await loadRouteDay();
    } catch (syncError) {
      if (mode === "manual") {
        setError(syncError instanceof Error ? syncError.message : "Unable to sync queued actions.");
      }
    } finally {
      setSyncingQueue(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Costa Rica</Text>
          <Text style={styles.title}>{t("en", "app.name")}</Text>
          <Text style={styles.subtitle}>Session 9 now caches route data in SQLite, queues visits, evidence, notes, and consignations offline, and retries them in the background.</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Authentication</Text>
          {mobileSession?.profile ? (
            <View style={styles.notePanel}>
              <Text style={styles.taskTitle}>{mobileSession.profile.user.name}</Text>
              <Text style={styles.taskMeta}>{mobileSession.profile.user.email}</Text>
              <Text style={styles.taskMeta}>
                {mobileSession.profile.user.role} / {mobileSession.profile.session.provider}
              </Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => void signOut()}>
                <Text style={styles.secondaryButtonText}>{t("en", "auth.signOut")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.notePanel}>
              <Text style={styles.taskMeta}>{t("en", "auth.loginRequired")}</Text>
              <TouchableOpacity
                disabled={authBusy || !GOOGLE_CLIENT_ID || !request}
                style={styles.primaryButton}
                onPress={() => void startGoogleSignIn()}
              >
                <Text style={styles.primaryButtonText}>
                  {authBusy ? "Opening Google..." : t("en", "auth.signIn")}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator color="#1f7a5b" />
            <Text style={styles.loadingText}>Loading route day...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorTitle}>{t("en", "visits.mobileFallback")}</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {statusMessage ? (
          <View style={styles.successPanel}>
            <Text style={styles.successTitle}>{statusMessage}</Text>
          </View>
        ) : null}

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Pending sync queue</Text>
          {pendingSyncOperations.length > 0 ? (
            pendingSyncOperations.map((operation) => (
              <View key={operation.id} style={styles.syncCard}>
                <Text style={styles.syncTitle}>{operation.type}</Text>
                <Text style={styles.syncMeta}>
                  {operation.state} / retries {operation.retryCount}
                </Text>
                <Text style={styles.syncMeta}>{JSON.stringify(operation.payload)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.syncMeta}>No queued offline actions.</Text>
          )}
          <TouchableOpacity disabled={syncingQueue || pendingSyncOperations.length === 0} style={styles.primaryButton} onPress={() => void syncQueuedOperationsNow("manual")}>
            <Text style={styles.primaryButtonText}>{syncingQueue ? "Syncing queued actions..." : "Sync queued actions"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>{t("en", "visits.routeDay")}</Text>
          {visibleVisits.map((visit) => {
            const linkedTask = visibleTasks.find((task) => task.id === visit.taskId);
            const pointOfSale = pointsOfSale.find((item) => item.id === visit.pointOfSaleId)?.name ?? "Escazu Plaza";
            const taskEvidence = evidence.filter((item) => item.taskId === visit.taskId);
            const taskComments = comments.filter((item) => item.taskId === visit.taskId);
            const taskObservations = observations.filter((item) => item.taskId === visit.taskId);
            const taskConsignations = consignations.filter((item) => item.taskId === visit.taskId);
            const summary = requirementSummaries.find((item) => item.taskId === visit.taskId);

            return (
              <View style={styles.taskCard} key={visit.id}>
                <View style={styles.taskHeader}>
                  <View style={styles.taskHeaderCopy}>
                    <Text style={styles.taskTitle}>{linkedTask?.title ?? visit.taskId}</Text>
                    <Text style={styles.taskMeta}>
                      {visit.scheduledFor} - {t("en", `visitStatus.${visit.status}` as never)}
                    </Text>
                  </View>
                  <View style={styles.taskBadge}>
                    <Text style={styles.taskBadgeText}>{pointOfSale}</Text>
                  </View>
                </View>

                <View style={styles.routePanel}>
                  <Text style={styles.routeLabel}>Route scope</Text>
                  <Text style={styles.routeValue}>San Jose / Central / {pointOfSale}</Text>
                  <Text style={styles.routeValue}>
                    Check-in: {visit.checkedInAt ?? "Pending"} {"\n"}
                    Check-out: {visit.checkedOutAt ?? "Pending"}
                  </Text>
                  <Text style={styles.routeValue}>
                    {t("en", "evidence.requirements")}: {summary?.missingTypes.length ? `Missing ${summary.missingTypes.join(", ")}` : "Complete"}
                  </Text>
                </View>

                <View style={styles.requirementList}>
                  {taskEvidence.map((item: EvidencePhoto) => {
                    const mediaAsset = mediaAssets.find((asset) => asset.id === item.mediaAssetId);
                    return (
                      <View key={item.id} style={styles.evidenceCard}>
                        <View style={styles.evidenceThumb}>
                          <Text style={styles.evidenceThumbLabel}>{item.type.toUpperCase()}</Text>
                        </View>
                        <View style={styles.evidenceCopy}>
                          <Text style={styles.requirement}>
                            {t("en", `evidence.type.${item.type}` as never)} - {t("en", `uploadStatus.${item.uploadStatus}` as never)}
                          </Text>
                          <Text style={styles.syncMeta}>
                            Progress {Math.round(mediaAsset?.uploadProgress ?? 0)}% / chunks {mediaAsset?.uploadedChunkCount ?? 0} of {mediaAsset?.chunkCount ?? 0}
                          </Text>
                          <Text style={styles.syncMeta}>Session {mediaAsset?.uploadSessionId ?? "pending"}</Text>
                          <Text style={styles.syncMeta}>Retry count {mediaAsset?.retryCount ?? 0}</Text>
                          {mediaAsset?.lastError ? <Text style={styles.errorText}>{mediaAsset.lastError}</Text> : null}
                        </View>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.notePanel}>
                  <Text style={styles.captureHeading}>Notes</Text>
                  {taskComments.map((item: Comment) => (
                    <Text key={item.id} style={styles.syncMeta}>
                      {t("en", "notes.comment")}: {item.body}
                    </Text>
                  ))}
                  {taskObservations.map((item: Observation) => (
                    <Text key={item.id} style={styles.syncMeta}>
                      {t("en", "notes.observation")}: {item.body}
                    </Text>
                  ))}
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => void addQuickComment(visit.taskId)}>
                    <Text style={styles.secondaryButtonText}>{t("en", "notes.addComment")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => void addQuickObservation(visit.taskId)}>
                    <Text style={styles.secondaryButtonText}>{t("en", "notes.addObservation")}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.notePanel}>
                  <Text style={styles.captureHeading}>Consignations</Text>
                  {taskConsignations.map((item: Consignation) => (
                    <View key={item.id} style={styles.inlineActions}>
                      <Text style={styles.syncMeta}>
                        {t("en", `consignation.status.${item.status}` as never)} / {item.preparedAt}
                      </Text>
                      {item.status === "prepared" ? (
                        <TouchableOpacity style={styles.secondaryButton} onPress={() => void sendConsignation(item)}>
                          <Text style={styles.secondaryButtonText}>{t("en", "consignation.send")}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))}
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => void prepareConsignation(visit.taskId, visit.id)}>
                    <Text style={styles.secondaryButtonText}>{t("en", "consignation.prepare")}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.actions}>
                  {visit.status === "scheduled" ? (
                    <TouchableOpacity style={styles.primaryButton} onPress={() => void transitionVisit(visit, "check_in")}>
                      <Text style={styles.primaryButtonText}>{t("en", "visits.checkIn")}</Text>
                    </TouchableOpacity>
                  ) : null}
                  {visit.status === "checked_in" ? (
                    <TouchableOpacity style={styles.primaryButton} onPress={() => void transitionVisit(visit, "check_out")}>
                      <Text style={styles.primaryButtonText}>{t("en", "visits.checkOut")}</Text>
                    </TouchableOpacity>
                  ) : null}

                  <Text style={styles.captureHeading}>Before evidence</Text>
                  <CaptureActionRow
                    cameraBusy={captureBusyKey === `${visit.taskId}:before:camera`}
                    libraryBusy={captureBusyKey === `${visit.taskId}:before:library`}
                    onCamera={() => void captureEvidence(visit.taskId, visit.id, "before", "camera")}
                    onLibrary={() => void captureEvidence(visit.taskId, visit.id, "before", "library")}
                  />

                  <Text style={styles.captureHeading}>After evidence</Text>
                  <CaptureActionRow
                    cameraBusy={captureBusyKey === `${visit.taskId}:after:camera`}
                    libraryBusy={captureBusyKey === `${visit.taskId}:after:library`}
                    onCamera={() => void captureEvidence(visit.taskId, visit.id, "after", "camera")}
                    onLibrary={() => void captureEvidence(visit.taskId, visit.id, "after", "library")}
                  />

                  <Text style={styles.captureHeading}>Supporting evidence</Text>
                  <CaptureActionRow
                    cameraBusy={captureBusyKey === `${visit.taskId}:supporting:camera`}
                    libraryBusy={captureBusyKey === `${visit.taskId}:supporting:library`}
                    onCamera={() => void captureEvidence(visit.taskId, visit.id, "supporting", "camera")}
                    onLibrary={() => void captureEvidence(visit.taskId, visit.id, "supporting", "library")}
                  />

                  {taskEvidence.map((item) => {
                    const mediaAsset = mediaAssets.find((asset) => asset.id === item.mediaAssetId);
                    if (!mediaAsset) {
                      return null;
                    }

                    return (
                      <View key={`actions-${item.id}`} style={styles.inlineActions}>
                        {mediaAsset.uploadStatus === "failed" ? (
                          <TouchableOpacity style={styles.primaryButton} onPress={() => void requestRetry(mediaAsset)}>
                            <Text style={styles.primaryButtonText}>Retry upload</Text>
                          </TouchableOpacity>
                        ) : null}
                        {mediaAsset.uploadStatus !== "uploaded" ? (
                          <TouchableOpacity style={styles.secondaryButton} onPress={() => void updateMediaUpload(mediaAsset, "uploading")}>
                            <Text style={styles.secondaryButtonText}>Resume upload</Text>
                          </TouchableOpacity>
                        ) : null}
                        {mediaAsset.uploadStatus !== "failed" && mediaAsset.uploadStatus !== "uploaded" ? (
                          <TouchableOpacity style={styles.secondaryButton} onPress={() => void updateMediaUpload(mediaAsset, "failed")}>
                            <Text style={styles.secondaryButtonText}>Mark sync failed</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Assigned tasks</Text>
          {visibleTasks.map((task) => {
            const pointOfSale = pointsOfSale.find((item) => item.id === task.pointOfSaleId)?.name ?? "Escazu Plaza";
            const summary = requirementSummaries.find((item) => item.taskId === task.id);

            return (
              <View style={styles.taskCard} key={task.id}>
                <View style={styles.taskHeader}>
                  <View style={styles.taskHeaderCopy}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    <Text style={styles.taskMeta}>
                      {task.scheduledFor} - {t("en", `status.${task.status}` as never)}
                    </Text>
                  </View>
                  <View style={styles.taskBadge}>
                    <Text style={styles.taskBadgeText}>{t("en", `priority.${task.priority}` as never)}</Text>
                  </View>
                </View>

                <View style={styles.routePanel}>
                  <Text style={styles.routeLabel}>Route scope</Text>
                  <Text style={styles.routeValue}>San Jose / Central / {pointOfSale}</Text>
                  <Text style={styles.routeValue}>
                    {t("en", "evidence.requirements")}: {summary?.missingTypes.length ? summary.missingTypes.join(", ") : "Complete"}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => void loadRouteDay()}>
            <Text style={styles.primaryButtonText}>Refresh route day</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CaptureActionRow({
  cameraBusy,
  libraryBusy,
  onCamera,
  onLibrary
}: {
  cameraBusy: boolean;
  libraryBusy: boolean;
  onCamera: () => void;
  onLibrary: () => void;
}) {
  return (
    <View style={styles.captureRow}>
      <TouchableOpacity disabled={cameraBusy || libraryBusy} style={styles.primaryButton} onPress={onCamera}>
        <Text style={styles.primaryButtonText}>{cameraBusy ? "Opening camera..." : "Use camera"}</Text>
      </TouchableOpacity>
      <TouchableOpacity disabled={cameraBusy || libraryBusy} style={styles.secondaryButton} onPress={onLibrary}>
        <Text style={styles.secondaryButtonText}>{libraryBusy ? "Opening library..." : "Use library"}</Text>
      </TouchableOpacity>
    </View>
  );
}

function createFallbackBootstrap(): EvidenceBootstrap {
  return {
    evidence: [],
    mediaAssets: [],
    comments: [],
    observations: [],
    consignations: [],
    pointsOfSale: [],
    tasks: fallbackTasks,
    visits: fallbackVisits,
    users: [],
    workflowRules: [],
    requirementSummaries: [],
    pendingSyncOperations: []
  };
}

function applyPendingOperationsToBootstrap(base: EvidenceBootstrap, operations: SyncOperation[]): EvidenceBootstrap {
  const next: EvidenceBootstrap = {
    ...base,
    evidence: [...base.evidence],
    mediaAssets: [...base.mediaAssets],
    comments: [...base.comments],
    observations: [...base.observations],
    consignations: [...base.consignations],
    visits: [...base.visits],
    tasks: [...base.tasks],
    requirementSummaries: [...base.requirementSummaries],
    pendingSyncOperations: operations
  };

  for (const operation of operations) {
    if (operation.type === "visit_check_in") {
      const payload = operation.payload as VisitCheckInSyncPayload;
      next.visits = next.visits.map((visit) =>
        visit.id === payload.visitId
          ? { ...visit, status: "checked_in", checkedInAt: payload.checkedInAt, checkedInLatitude: payload.checkedInLatitude, checkedInLongitude: payload.checkedInLongitude }
          : visit
      );
    } else if (operation.type === "visit_check_out") {
      const payload = operation.payload as VisitCheckOutSyncPayload;
      next.visits = next.visits.map((visit) =>
        visit.id === payload.visitId
          ? { ...visit, status: "checked_out", checkedOutAt: payload.checkedOutAt, checkedOutLatitude: payload.checkedOutLatitude, checkedOutLongitude: payload.checkedOutLongitude }
          : visit
      );
    } else if (operation.type === "photo_upload") {
      const payload = operation.payload as PhotoUploadSyncPayload;
      const mediaStatus = operation.state === "sync_failed" ? "failed" : "pending_upload";
      const mediaSyncState = operation.state === "sync_failed" ? "sync_failed" : "pending_sync";
      upsertMediaAndEvidence(next, payload, operation, mediaStatus, mediaSyncState);
    } else if (operation.type === "comment_create") {
      const payload = operation.payload as CommentCreateSyncPayload;
      upsertComment(next, {
        id: `comment_local_${operation.id}`,
        organizationId: payload.organizationId,
        taskId: payload.taskId,
        userId: payload.userId,
        body: payload.body,
        createdAt: payload.createdAt
      });
    } else if (operation.type === "observation_create") {
      const payload = operation.payload as ObservationCreateSyncPayload;
      upsertObservation(next, {
        id: `observation_local_${operation.id}`,
        organizationId: payload.organizationId,
        taskId: payload.taskId,
        userId: payload.userId,
        body: payload.body,
        createdAt: payload.createdAt
      });
    } else if (operation.type === "consignation_prepare") {
      const payload = operation.payload as ConsignationPrepareSyncPayload;
      upsertConsignation(next, {
        id: payload.localConsignationId,
        organizationId: payload.organizationId,
        taskId: payload.taskId,
        userId: payload.userId,
        visitId: payload.visitId,
        note: payload.note,
        status: "prepared",
        preparedAt: payload.preparedAt
      });
    } else if (operation.type === "consignation_send") {
      const payload = operation.payload as ConsignationSendSyncPayload;
      const targetId = payload.localConsignationId ?? payload.consignationId;
      next.consignations = next.consignations.map((item) =>
        item.id === targetId ? { ...item, status: "sent", sentAt: payload.sentAt } : item
      );
    }
  }

  return next;
}

function upsertMediaAndEvidence(
  bootstrap: EvidenceBootstrap,
  payload: PhotoUploadSyncPayload,
  operation: SyncOperation,
  mediaStatus: UploadStatus,
  mediaSyncState: MediaAsset["syncState"]
) {
  const mediaAsset: MediaAsset = {
    id: payload.localMediaAssetId,
    organizationId: payload.uploadRequest.organizationId,
    uploaderUserId: payload.uploadRequest.uploaderUserId,
    fileName: payload.uploadRequest.fileName,
    mimeType: payload.uploadRequest.mimeType,
    originalStoragePath: "local-pending://original",
    thumbnailStoragePath: "local-pending://thumbnail",
    capturedAt: payload.uploadRequest.capturedAt,
    uploadStatus: mediaStatus,
    syncState: mediaSyncState,
    uploadSessionId: `offline_${operation.id}`,
    uploadProgress: 0,
    retryCount: operation.retryCount,
    lastError: operation.errorMessage,
    chunkCount: 1,
    uploadedChunkCount: 0,
    byteSize: payload.uploadRequest.byteSize,
    width: payload.uploadRequest.width,
    height: payload.uploadRequest.height
  };
  const evidencePhoto: EvidencePhoto = {
    id: payload.localEvidenceId,
    organizationId: payload.uploadRequest.organizationId,
    uploaderUserId: payload.uploadRequest.uploaderUserId,
    taskId: payload.uploadRequest.taskId,
    visitId: payload.uploadRequest.visitId,
    mediaAssetId: payload.localMediaAssetId,
    type: payload.uploadRequest.type,
    capturedAt: payload.uploadRequest.capturedAt,
    latitude: payload.uploadRequest.latitude,
    longitude: payload.uploadRequest.longitude,
    uploadStatus: mediaStatus
  };

  const mediaIndex = bootstrap.mediaAssets.findIndex((item) => item.id === payload.localMediaAssetId);
  if (mediaIndex >= 0) {
    bootstrap.mediaAssets[mediaIndex] = mediaAsset;
  } else {
    bootstrap.mediaAssets.unshift(mediaAsset);
  }

  const evidenceIndex = bootstrap.evidence.findIndex((item) => item.id === payload.localEvidenceId);
  if (evidenceIndex >= 0) {
    bootstrap.evidence[evidenceIndex] = evidencePhoto;
  } else {
    bootstrap.evidence.unshift(evidencePhoto);
  }
}

function upsertComment(bootstrap: EvidenceBootstrap, comment: Comment) {
  const index = bootstrap.comments.findIndex((item) => item.id === comment.id);
  if (index >= 0) {
    bootstrap.comments[index] = comment;
  } else {
    bootstrap.comments.unshift(comment);
  }
}

function upsertObservation(bootstrap: EvidenceBootstrap, observation: Observation) {
  const index = bootstrap.observations.findIndex((item) => item.id === observation.id);
  if (index >= 0) {
    bootstrap.observations[index] = observation;
  } else {
    bootstrap.observations.unshift(observation);
  }
}

function upsertConsignation(bootstrap: EvidenceBootstrap, consignation: Consignation) {
  const index = bootstrap.consignations.findIndex((item) => item.id === consignation.id);
  if (index >= 0) {
    bootstrap.consignations[index] = consignation;
  } else {
    bootstrap.consignations.unshift(consignation);
  }
}

function findQueuedPhotoOperation(operations: SyncOperation[], mediaAssetId: string) {
  return operations.find(
    (operation) => operation.type === "photo_upload" && (operation.payload as PhotoUploadSyncPayload).localMediaAssetId === mediaAssetId
  );
}

function buildUploadStatusPayload(mediaAsset: MediaAsset, nextStatus: UploadStatus) {
  const chunkCount = mediaAsset.chunkCount ?? 4;
  if (nextStatus === "uploaded") {
    return {
      uploadStatus: nextStatus,
      syncState: "synced",
      uploadSessionId: mediaAsset.uploadSessionId,
      uploadProgress: 100,
      retryCount: mediaAsset.retryCount,
      chunkCount,
      uploadedChunkCount: chunkCount
    };
  }

  if (nextStatus === "uploading") {
    return {
      uploadStatus: nextStatus,
      syncState: "pending_sync",
      uploadSessionId: mediaAsset.uploadSessionId ?? `upload_${Date.now()}`,
      uploadProgress: Math.max(35, mediaAsset.uploadProgress || 0),
      retryCount: mediaAsset.retryCount,
      chunkCount,
      uploadedChunkCount: Math.max(1, Math.min(chunkCount - 1, mediaAsset.uploadedChunkCount ?? 1))
    };
  }

  return {
    uploadStatus: nextStatus,
    syncState: "sync_failed",
    uploadSessionId: mediaAsset.uploadSessionId ?? `upload_${Date.now()}`,
    uploadProgress: mediaAsset.uploadProgress,
    retryCount: mediaAsset.retryCount,
    chunkCount,
    uploadedChunkCount: mediaAsset.uploadedChunkCount ?? 0,
    lastError: "Mobile upload failed while resuming from a weak connection."
  };
}

async function syncJsonRequest(url: string, method: "POST" | "PATCH", payload: unknown) {
  const response = await authenticatedMobileFetch(url, {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Sync request failed with status ${response.status}.`);
  }

  return (await response.json()) as { item?: { id?: string } };
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: "#fff8f8", flex: 1 },
  container: { gap: 18, padding: 20 },
  header: { gap: 6 },
  eyebrow: { color: "#c5333f", fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
  title: { color: "#251b1d", fontSize: 28, fontWeight: "800" },
  subtitle: { color: "#746568", lineHeight: 22 },
  loadingPanel: { alignItems: "center", backgroundColor: "#fdf2f3", borderRadius: 8, gap: 8, padding: 16 },
  loadingText: { color: "#96212c" },
  errorPanel: { backgroundColor: "#fff0f1", borderRadius: 8, gap: 6, padding: 16 },
  errorTitle: { color: "#8a2f27", fontWeight: "700" },
  errorText: { color: "#8a2f27" },
  successPanel: { backgroundColor: "#fff5f5", borderRadius: 8, padding: 16 },
  successTitle: { color: "#96212c", fontWeight: "700" },
  panel: { backgroundColor: "#ffffff", borderColor: "#eadcdf", borderRadius: 8, borderWidth: 1, padding: 16 },
  sectionTitle: { color: "#251b1d", fontSize: 18, fontWeight: "700", marginBottom: 12 },
  syncCard: { backgroundColor: "#fffafb", borderRadius: 8, gap: 4, marginBottom: 10, padding: 12 },
  syncTitle: { color: "#251b1d", fontWeight: "700" },
  syncMeta: { color: "#746568", fontSize: 12 },
  taskCard: { borderColor: "#eadcdf", borderRadius: 8, borderWidth: 1, gap: 12, marginBottom: 12, padding: 14 },
  taskHeader: { alignItems: "flex-start", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  taskHeaderCopy: { flex: 1, gap: 4 },
  taskTitle: { color: "#251b1d", fontSize: 16, fontWeight: "700" },
  taskMeta: { color: "#746568" },
  taskBadge: { backgroundColor: "#fdf1f3", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  taskBadgeText: { color: "#96212c", fontSize: 12, fontWeight: "700" },
  routePanel: { backgroundColor: "#fffafb", borderRadius: 8, gap: 4, padding: 12 },
  routeLabel: { color: "#746568", fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  routeValue: { color: "#251b1d" },
  requirementList: { gap: 8 },
  evidenceCard: { alignItems: "center", flexDirection: "row", gap: 12 },
  evidenceThumb: { alignItems: "center", backgroundColor: "#fdf2f3", borderRadius: 8, height: 56, justifyContent: "center", width: 56 },
  evidenceThumbLabel: { color: "#96212c", fontSize: 11, fontWeight: "700" },
  evidenceCopy: { flex: 1, gap: 2 },
  requirement: { color: "#96212c", fontWeight: "600" },
  actions: { gap: 10 },
  inlineActions: { gap: 10 },
  notePanel: { backgroundColor: "#fffafb", borderRadius: 8, gap: 8, padding: 12 },
  captureHeading: { color: "#251b1d", fontSize: 14, fontWeight: "700" },
  captureRow: { gap: 10 },
  primaryButton: { alignItems: "center", backgroundColor: "#c5333f", borderRadius: 8, padding: 14 },
  primaryButtonText: { color: "#ffffff", fontWeight: "700" },
  secondaryButton: { alignItems: "center", borderColor: "#c5333f", borderRadius: 8, borderWidth: 1, padding: 14 },
  secondaryButtonText: { color: "#c5333f", fontWeight: "700" }
});
