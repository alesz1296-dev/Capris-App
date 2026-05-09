import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import * as AuthSession from "expo-auth-session";
import * as ImagePicker from "expo-image-picker";
import {
  type Activity,
  type ActivityCreateSyncPayload,
  type Client,
  type Locale,
  t,
  type Comment,
  type CommentCreateSyncPayload,
  type Consignation,
  type ConsignationPrepareSyncPayload,
  type ConsignationFailSyncPayload,
  type ConsignationReviewSyncPayload,
  type ConsignationSendSyncPayload,
  type EvidenceBootstrap,
  type EvidencePhoto,
  type EvidenceType,
  type ExhibitionCreateSyncPayload,
  type ExhibitionInstallation,
  type MediaAsset,
  type Observation,
  type ObservationCreateSyncPayload,
  type PhotoUploadSyncPayload,
  type PrepareConsignationInput,
  type ReviewConsignationInput,
  type CreateActivityInput,
  type CreateExhibitionInstallationInput,
  type SyncOperation,
  type Task,
  type UploadCapturedEvidenceInput,
  type UploadStatus,
  type Visit,
  type VisitCheckInSyncPayload,
  type VisitCheckOutSyncPayload
} from "@capris/shared";
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
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
import { resolveDeviceCoordinates, type CapturedDeviceLocation } from "./device-location";

const FIELD_USER_ID = "user_field_001";
const ORGANIZATION_ID = "org_capris";
const AUTO_SYNC_INTERVAL_MS = 15000;

type ConsignationReviewDraft = {
  recipientEmails: string;
  emailSubject: string;
  emailBody: string;
  beforeEvidenceId?: string;
  afterEvidenceId?: string;
};

function textByLocale(locale: Locale, english: string, spanish: string) {
  return locale === "es" ? spanish : english;
}

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
  const [consignationReviewDrafts, setConsignationReviewDrafts] = useState<Record<string, ConsignationReviewDraft>>({});
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [currentLocationSnapshot, setCurrentLocationSnapshot] = useState<CapturedDeviceLocation | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const autoSyncEnabledRef = useRef(true);
  const effectiveUserId = mobileSession?.profile?.user.id ?? FIELD_USER_ID;
  const locale: Locale = mobileSession?.profile?.user.locale ?? "en";
  const localeTag = locale === "es" ? "es-CR" : "en-US";
  const formatTime = (value: Date) => value.toLocaleTimeString(localeTag);

  const tasks = bootstrap?.tasks.length ? bootstrap.tasks : fallbackTasks;
  const visits = bootstrap?.visits.length ? bootstrap.visits : fallbackVisits;
  const evidence = bootstrap?.evidence ?? [];
  const mediaAssets = bootstrap?.mediaAssets ?? [];
  const comments = bootstrap?.comments ?? [];
  const observations = bootstrap?.observations ?? [];
  const consignations = bootstrap?.consignations ?? [];
  const activities = bootstrap?.activities ?? [];
  const clients = bootstrap?.clients ?? [];
  const exhibitions = bootstrap?.exhibitions ?? [];
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
      setError(textByLocale(locale, "Google sign-in did not return an ID token.", "El inicio de sesion con Google no devolvio un token de identificacion."));
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

  useEffect(() => {
    setConsignationReviewDrafts((current) => {
      const generated = buildConsignationReviewDrafts(consignations, tasks, clients, evidence);
      const next: Record<string, ConsignationReviewDraft> = {};

      for (const consignation of consignations) {
        next[consignation.id] = current[consignation.id]
          ? {
              ...generated[consignation.id],
              ...current[consignation.id]
            }
          : generated[consignation.id];
      }

      return next;
    });
  }, [clients, consignations, evidence, tasks]);

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
        void refreshCurrentLocation();
      } else {
        setStatusMessage(textByLocale(locale, "Sign in with Google to sync live route data.", "Inicia sesion con Google para sincronizar datos de ruta en vivo."));
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
      setStatusMessage(textByLocale(locale, "Signed in on mobile.", "Sesion iniciada en movil."));
      await loadRouteDay();
      void refreshCurrentLocation();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : textByLocale(locale, "Unable to sign in on mobile.", "No se pudo iniciar sesion en movil."));
    } finally {
      setAuthBusy(false);
    }
  }

  async function startGoogleSignIn() {
    if (!GOOGLE_CLIENT_ID || !request) {
      setError(textByLocale(locale, "Google sign-in is not configured for this mobile environment.", "El inicio de sesion con Google no esta configurado para este entorno movil."));
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
    setStatusMessage(textByLocale(locale, "Signed out on mobile.", "Sesion cerrada en movil."));
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
      setError(
        loadError instanceof Error
          ? `${loadError.message} ${textByLocale(locale, "Using offline cache.", "Usando cache sin conexion.")}`
          : textByLocale(locale, "Unable to load route day. Using offline cache.", "No se pudo cargar la ruta del dia. Usando cache sin conexion.")
      );
    } finally {
      setLoading(false);
    }
  }

  async function refreshCurrentLocation(pointOfSaleId?: string) {
    try {
      setLocationBusy(true);
      const linkedPointOfSale = pointsOfSale.find((pointOfSale) => pointOfSale.id === pointOfSaleId);
      const nextLocation = await resolveDeviceCoordinates({
        locale,
        pointOfSaleName: linkedPointOfSale?.name,
        pointOfSaleLatitude: linkedPointOfSale?.latitude,
        pointOfSaleLongitude: linkedPointOfSale?.longitude
      });
      setCurrentLocationSnapshot(nextLocation);
    } finally {
      setLocationBusy(false);
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
    const location = await resolveDeviceCoordinates({
      locale,
      pointOfSaleName: linkedPointOfSale?.name,
      pointOfSaleLatitude: linkedPointOfSale?.latitude,
      pointOfSaleLongitude: linkedPointOfSale?.longitude
    });
    setCurrentLocationSnapshot(location);
    const endpoint = action === "check_in" ? "check-in" : "check-out";
    const payload =
      action === "check_in"
        ? ({
            visitId: visit.id,
            checkedInAt: new Date().toISOString(),
            checkedInLatitude: location.latitude,
            checkedInLongitude: location.longitude
          } satisfies VisitCheckInSyncPayload)
        : ({
            visitId: visit.id,
            checkedOutAt: new Date().toISOString(),
            checkedOutLatitude: location.latitude,
            checkedOutLongitude: location.longitude
          } satisfies VisitCheckOutSyncPayload);

    try {
      await syncJsonRequest(`${API_BASE_URL}/visits/${visit.id}/${endpoint}`, "PATCH", payload);
      setStatusMessage(
        action === "check_in"
          ? textByLocale(locale, "Visit checked in.", "Visita registrada al entrar.")
          : textByLocale(locale, "Visit checked out.", "Visita registrada al salir.")
      );
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
        action === "check_in"
          ? textByLocale(locale, "Visit check-in queued for sync.", "Entrada de visita en cola para sincronizacion.")
          : textByLocale(locale, "Visit check-out queued for sync.", "Salida de visita en cola para sincronizacion.")
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
        Alert.alert(
          textByLocale(locale, "Permission needed", "Permiso requerido"),
          source === "camera"
            ? textByLocale(locale, "Camera permission is required.", "Se requiere permiso para usar la camara.")
            : textByLocale(locale, "Photo library permission is required.", "Se requiere permiso para usar la galeria.")
        );
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
        throw new Error(textByLocale(locale, "Selected image is missing base64 data.", "La imagen seleccionada no incluye datos base64."));
      }
      const clientOperationId = `sync_photo_upload_${Date.now()}`;
      const linkedVisit = visits.find((item) => item.id === visitId);
      const linkedPointOfSale = pointsOfSale.find(
        (pointOfSale) => pointOfSale.id === linkedVisit?.pointOfSaleId || pointOfSale.id === visibleTasks.find((task) => task.id === taskId)?.pointOfSaleId
      );
      const location = await resolveDeviceCoordinates({
        locale,
        pointOfSaleName: linkedPointOfSale?.name,
        pointOfSaleLatitude: linkedPointOfSale?.latitude,
        pointOfSaleLongitude: linkedPointOfSale?.longitude
      });
      setCurrentLocationSnapshot(location);
      const uploadRequest: UploadCapturedEvidenceInput = {
        organizationId: ORGANIZATION_ID,
        taskId,
        visitId,
        uploaderUserId: effectiveUserId,
        clientOperationId,
        type,
        capturedAt: new Date().toISOString(),
        latitude: location.latitude,
        longitude: location.longitude,
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
        setStatusMessage(
          locale === "es"
            ? `${t(locale, `evidence.type.${type}` as never)} cargada desde ${source === "camera" ? "camara" : "galeria"}.`
            : `${t(locale, `evidence.type.${type}` as never)} uploaded from ${source}.`
        );
        await loadRouteDay();
      } catch {
        const localMediaAssetId = `media_local_${Date.now()}`;
        const localEvidenceId = `evidence_local_${Date.now()}`;
        await queueOperation(
          {
            id: clientOperationId,
            type: "photo_upload",
            state: "pending_sync",
            payload: {
              clientOperationId,
              uploadRequest,
              localEvidenceId,
              localMediaAssetId
            } satisfies PhotoUploadSyncPayload,
            retryCount: 0,
            createdAt: uploadRequest.capturedAt
          },
          locale === "es"
            ? `${t(locale, `evidence.type.${type}` as never)} en cola para carga sin conexion.`
            : `${t(locale, `evidence.type.${type}` as never)} queued for offline upload.`
        );
      }
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : textByLocale(locale, "Unable to capture evidence.", "No se pudo capturar la evidencia."));
    } finally {
      setCaptureBusyKey(null);
    }
  }

  async function addQuickComment(taskId: string) {
    const clientOperationId = `sync_comment_${Date.now()}`;
    const payload: CommentCreateSyncPayload = {
      organizationId: ORGANIZATION_ID,
      taskId,
      userId: effectiveUserId,
      clientOperationId,
      body: `${textByLocale(locale, "Field comment", "Comentario de campo")} ${formatTime(new Date())}`,
      createdAt: new Date().toISOString()
    };

    try {
      await syncJsonRequest(`${API_BASE_URL}/notes/comments`, "POST", payload);
      setStatusMessage(textByLocale(locale, "Comment saved.", "Comentario guardado."));
      await loadRouteDay();
    } catch {
      await queueOperation(
        {
          id: clientOperationId,
          type: "comment_create",
          state: "pending_sync",
          payload,
          retryCount: 0,
          createdAt: payload.createdAt
        },
        textByLocale(locale, "Comment queued for sync.", "Comentario en cola para sincronizacion.")
      );
    }
  }

  async function addQuickObservation(taskId: string) {
    const clientOperationId = `sync_observation_${Date.now()}`;
    const payload: ObservationCreateSyncPayload = {
      organizationId: ORGANIZATION_ID,
      taskId,
      userId: effectiveUserId,
      clientOperationId,
      body: `${textByLocale(locale, "Field observation", "Observacion de campo")} ${formatTime(new Date())}`,
      createdAt: new Date().toISOString()
    };

    try {
      await syncJsonRequest(`${API_BASE_URL}/notes/observations`, "POST", payload);
      setStatusMessage(textByLocale(locale, "Observation saved.", "Observacion guardada."));
      await loadRouteDay();
    } catch {
      await queueOperation(
        {
          id: clientOperationId,
          type: "observation_create",
          state: "pending_sync",
          payload,
          retryCount: 0,
          createdAt: payload.createdAt
        },
        textByLocale(locale, "Observation queued for sync.", "Observacion en cola para sincronizacion.")
      );
    }
  }

  async function recordActivity(taskId: string, visitId?: string, pointOfSaleId?: string) {
    const clientOperationId = `sync_activity_${Date.now()}`;
    const payload: ActivityCreateSyncPayload = {
      organizationId: ORGANIZATION_ID,
      taskId,
      userId: effectiveUserId,
      clientOperationId,
      visitId,
      pointOfSaleId,
      quantity: 1,
      note: `${textByLocale(locale, "Activity recorded", "Actividad registrada")} ${formatTime(new Date())}`,
      recordedAt: new Date().toISOString()
    };

    try {
      await syncJsonRequest(`${API_BASE_URL}/activities`, "POST", payload satisfies CreateActivityInput);
      setStatusMessage(textByLocale(locale, "Activity recorded.", "Actividad registrada."));
      await loadRouteDay();
    } catch {
      await queueOperation(
        {
          id: clientOperationId,
          type: "activity_create",
          state: "pending_sync",
          payload,
          retryCount: 0,
          createdAt: payload.recordedAt
        },
        textByLocale(locale, "Activity queued for sync.", "Actividad en cola para sincronizacion.")
      );
    }
  }

  async function recordExhibition(taskId: string, visitId?: string, pointOfSaleId?: string) {
    const clientOperationId = `sync_exhibition_${Date.now()}`;
    const payload: ExhibitionCreateSyncPayload = {
      organizationId: ORGANIZATION_ID,
      taskId,
      userId: effectiveUserId,
      clientOperationId,
      visitId,
      pointOfSaleId,
      quantity: 1,
      note: `${textByLocale(locale, "Exhibition installation recorded", "Instalacion de exhibicion registrada")} ${formatTime(new Date())}`,
      recordedAt: new Date().toISOString()
    };

    try {
      await syncJsonRequest(`${API_BASE_URL}/exhibitions`, "POST", payload satisfies CreateExhibitionInstallationInput);
      setStatusMessage(textByLocale(locale, "Exhibition installation recorded.", "Instalacion de exhibicion registrada."));
      await loadRouteDay();
    } catch {
      await queueOperation(
        {
          id: clientOperationId,
          type: "exhibition_create",
          state: "pending_sync",
          payload,
          retryCount: 0,
          createdAt: payload.recordedAt
        },
        textByLocale(locale, "Exhibition installation queued for sync.", "Instalacion de exhibicion en cola para sincronizacion.")
      );
    }
  }

  async function prepareConsignation(taskId: string, visitId?: string) {
    const localConsignationId = `consignation_local_${Date.now()}`;
    const clientOperationId = `sync_consignation_prepare_${Date.now()}`;
    const payload: ConsignationPrepareSyncPayload = {
      localConsignationId,
      organizationId: ORGANIZATION_ID,
      taskId,
      userId: effectiveUserId,
      clientOperationId,
      visitId,
      note: textByLocale(locale, "Prepared in field workflow.", "Preparado en el flujo de campo."),
      preparedAt: new Date().toISOString()
    };

    try {
      await syncJsonRequest(`${API_BASE_URL}/consignations/prepare`, "POST", {
        organizationId: payload.organizationId,
        taskId: payload.taskId,
        userId: payload.userId,
        clientOperationId: payload.clientOperationId,
        visitId: payload.visitId,
        note: payload.note,
        preparedAt: payload.preparedAt
      } satisfies PrepareConsignationInput);
      setStatusMessage(textByLocale(locale, "Consignation prepared.", "Consignacion preparada."));
      await loadRouteDay();
    } catch {
      await queueOperation(
        {
          id: clientOperationId,
          type: "consignation_prepare",
          state: "pending_sync",
          payload,
          retryCount: 0,
          createdAt: payload.preparedAt
        },
        textByLocale(locale, "Consignation preparation queued for sync.", "Preparacion de consignacion en cola para sincronizacion.")
      );
    }
  }

  async function reviewConsignation(consignation: Consignation) {
    const draft =
      consignationReviewDrafts[consignation.id] ?? buildConsignationReviewDraft(consignation, tasks, clients, evidence);
    const recipientEmails = draft.recipientEmails
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);

    if (recipientEmails.length === 0) {
      setError(textByLocale(locale, "Add at least one recipient before reviewing the consignation.", "Agrega al menos un destinatario antes de revisar la consignacion."));
      return;
    }

    if (!draft.emailSubject.trim()) {
      setError(textByLocale(locale, "Email subject is required before reviewing the consignation.", "El asunto del correo es obligatorio antes de revisar la consignacion."));
      return;
    }

    if (!draft.emailBody.trim()) {
      setError(textByLocale(locale, "Email body is required before reviewing the consignation.", "El cuerpo del correo es obligatorio antes de revisar la consignacion."));
      return;
    }

    const payload: ConsignationReviewSyncPayload = {
      consignationId: consignation.id,
      clientOperationId: `sync_consignation_review_${Date.now()}`,
      localConsignationId: consignation.id.startsWith("consignation_local_") ? consignation.id : undefined,
      reviewedAt: new Date().toISOString(),
      recipientEmails,
      emailSubject: draft.emailSubject.trim(),
      emailBody: draft.emailBody.trim(),
      beforeEvidenceId: draft.beforeEvidenceId,
      afterEvidenceId: draft.afterEvidenceId
    };

    try {
      const resolvedId = payload.localConsignationId ?? payload.consignationId;
      await syncJsonRequest(`${API_BASE_URL}/consignations/${resolvedId}/review`, "PATCH", {
        clientOperationId: payload.clientOperationId,
        reviewedAt: payload.reviewedAt,
        recipientEmails: payload.recipientEmails,
        emailSubject: payload.emailSubject,
        emailBody: payload.emailBody,
        beforeEvidenceId: payload.beforeEvidenceId,
        afterEvidenceId: payload.afterEvidenceId
      } satisfies ReviewConsignationInput);
      setStatusMessage(textByLocale(locale, "Consignation reviewed and ready to send.", "Consignacion revisada y lista para enviar."));
      await loadRouteDay();
    } catch {
      await queueOperation(
        {
          id: payload.clientOperationId,
          type: "consignation_review",
          state: "pending_sync",
          payload,
          retryCount: 0,
          createdAt: payload.reviewedAt
        },
        textByLocale(locale, "Consignation review queued for sync.", "Revision de consignacion en cola para sincronizacion.")
      );
    }
  }

  async function sendConsignation(consignation: Consignation) {
    const payload: ConsignationSendSyncPayload = {
      consignationId: consignation.id,
      clientOperationId: `sync_consignation_send_${Date.now()}`,
      localConsignationId: consignation.id.startsWith("consignation_local_") ? consignation.id : undefined,
      sentAt: new Date().toISOString()
    };

    try {
      await syncJsonRequest(`${API_BASE_URL}/consignations/${consignation.id}/send`, "PATCH", {
        sentAt: payload.sentAt,
        clientOperationId: payload.clientOperationId
      });
      setStatusMessage(textByLocale(locale, "Consignation marked as sent.", "Consignacion marcada como enviada."));
      await loadRouteDay();
    } catch {
      await queueOperation(
        {
          id: payload.clientOperationId,
          type: "consignation_send",
          state: "pending_sync",
          payload,
          retryCount: 0,
          createdAt: payload.sentAt
        },
        textByLocale(locale, "Consignation send queued for sync.", "Envio de consignacion en cola para sincronizacion.")
      );
    }
  }

  async function failConsignation(consignation: Consignation) {
    const payload: ConsignationFailSyncPayload = {
      consignationId: consignation.id,
      clientOperationId: `sync_consignation_fail_${Date.now()}`,
      localConsignationId: consignation.id.startsWith("consignation_local_") ? consignation.id : undefined,
      failedAt: new Date().toISOString(),
      reason: textByLocale(locale, "Field user flagged send failure before delivery confirmation.", "El usuario de campo marco una falla de envio antes de la confirmacion de entrega.")
    };

    try {
      const resolvedId = payload.localConsignationId ?? payload.consignationId;
      await syncJsonRequest(`${API_BASE_URL}/consignations/${resolvedId}/fail`, "PATCH", {
        failedAt: payload.failedAt,
        clientOperationId: payload.clientOperationId,
        reason: payload.reason
      });
      setStatusMessage(textByLocale(locale, "Consignation marked as failed.", "Consignacion marcada como fallida."));
      await loadRouteDay();
    } catch {
      await queueOperation(
        {
          id: payload.clientOperationId,
          type: "consignation_fail",
          state: "pending_sync",
          payload,
          retryCount: 0,
          createdAt: payload.failedAt
        },
        textByLocale(locale, "Consignation failure queued for sync.", "Falla de consignacion en cola para sincronizacion.")
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
        errorMessage: nextStatus === "failed" ? textByLocale(locale, "Upload interrupted while offline.", "La carga se interrumpio sin conexion.") : undefined
      };
      await updateSyncOperation(updatedOperation);
      const nextOperations = localSyncOperations.map((operation) => (operation.id === queueOperation.id ? updatedOperation : operation));
      setLocalSyncOperations(nextOperations);
      await persistBootstrap(applyPendingOperationsToBootstrap(bootstrap ?? createFallbackBootstrap(), nextOperations));
      setStatusMessage(locale === "es" ? `${mediaAsset.fileName} actualizado localmente a ${nextStatus}.` : `${mediaAsset.fileName} updated locally to ${nextStatus}.`);
      return;
    }

    try {
      await syncJsonRequest(`${API_BASE_URL}/evidence/media/${mediaAsset.id}/upload-status`, "PATCH", buildUploadStatusPayload(mediaAsset, nextStatus));
      setStatusMessage(locale === "es" ? `${mediaAsset.fileName} cambio a ${nextStatus}.` : `${mediaAsset.fileName} moved to ${nextStatus}.`);
      await loadRouteDay();
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : textByLocale(locale, "Unable to update upload.", "No se pudo actualizar la carga."));
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
      setStatusMessage(locale === "es" ? `Reintento en cola para ${mediaAsset.fileName}.` : `Retry queued for ${mediaAsset.fileName}.`);
      return;
    }

    try {
      await syncJsonRequest(`${API_BASE_URL}/evidence/media/${mediaAsset.id}/retry`, "POST", {
        reason: textByLocale(locale, "Mobile retry requested after offline interruption", "Se solicito reintento movil despues de una interrupcion sin conexion"),
        chunkCount: mediaAsset.chunkCount ?? 4
      });
      setStatusMessage(locale === "es" ? `Reintento en cola para ${mediaAsset.fileName}.` : `Retry queued for ${mediaAsset.fileName}.`);
      await loadRouteDay();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : textByLocale(locale, "Unable to request retry.", "No se pudo solicitar el reintento."));
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
              clientOperationId: payload.clientOperationId,
              visitId: payload.visitId,
              note: payload.note,
              preparedAt: payload.preparedAt
            });
            localConsignationIdMap.set(payload.localConsignationId, result?.item?.id ?? payload.localConsignationId);
          } else if (operation.type === "consignation_review") {
            const payload = operation.payload as ConsignationReviewSyncPayload;
            const resolvedId = payload.localConsignationId ? localConsignationIdMap.get(payload.localConsignationId) ?? payload.localConsignationId : payload.consignationId;
            await syncJsonRequest(`${API_BASE_URL}/consignations/${resolvedId}/review`, "PATCH", {
              reviewedAt: payload.reviewedAt,
              clientOperationId: payload.clientOperationId,
              recipientEmails: payload.recipientEmails,
              emailSubject: payload.emailSubject,
              emailBody: payload.emailBody,
              beforeEvidenceId: payload.beforeEvidenceId,
              afterEvidenceId: payload.afterEvidenceId
            });
          } else if (operation.type === "consignation_fail") {
            const payload = operation.payload as ConsignationFailSyncPayload;
            const resolvedId = payload.localConsignationId ? localConsignationIdMap.get(payload.localConsignationId) ?? payload.localConsignationId : payload.consignationId;
            await syncJsonRequest(`${API_BASE_URL}/consignations/${resolvedId}/fail`, "PATCH", {
              failedAt: payload.failedAt,
              clientOperationId: payload.clientOperationId,
              reason: payload.reason
            });
          } else if (operation.type === "consignation_send") {
            const payload = operation.payload as ConsignationSendSyncPayload;
            const resolvedId = payload.localConsignationId ? localConsignationIdMap.get(payload.localConsignationId) ?? payload.localConsignationId : payload.consignationId;
            await syncJsonRequest(`${API_BASE_URL}/consignations/${resolvedId}/send`, "PATCH", { sentAt: payload.sentAt, clientOperationId: payload.clientOperationId });
          } else if (operation.type === "activity_create") {
            await syncJsonRequest(`${API_BASE_URL}/activities`, "POST", operation.payload);
          } else if (operation.type === "exhibition_create") {
            await syncJsonRequest(`${API_BASE_URL}/exhibitions`, "POST", operation.payload);
          }

          await removeSyncOperation(operation.id);
          currentOperations = currentOperations.filter((item) => item.id !== operation.id);
        } catch (syncError) {
          const failedOperation: SyncOperation = {
            ...operation,
            state: "sync_failed",
            retryCount: operation.retryCount + 1,
            lastAttemptAt: new Date().toISOString(),
            errorMessage: syncError instanceof Error ? syncError.message : textByLocale(locale, "Sync attempt failed.", "El intento de sincronizacion fallo.")
          };
          await updateSyncOperation(failedOperation);
          currentOperations = currentOperations.map((item) => (item.id === operation.id ? failedOperation : item));
        }
      }

      setLocalSyncOperations(currentOperations);
      if (mode === "manual" || currentOperations.length === 0) {
        setStatusMessage(
          currentOperations.length === 0
            ? textByLocale(locale, "Queued offline actions synced.", "Las acciones en cola se sincronizaron.")
            : textByLocale(locale, "Some actions still need another retry.", "Algunas acciones todavia necesitan otro reintento.")
        );
      }
      await loadRouteDay();
    } catch (syncError) {
      if (mode === "manual") {
        setError(syncError instanceof Error ? syncError.message : textByLocale(locale, "Unable to sync queued actions.", "No se pudieron sincronizar las acciones en cola."));
      }
    } finally {
      setSyncingQueue(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{textByLocale(locale, "Costa Rica", "Costa Rica")}</Text>
          <Text style={styles.title}>{t(locale, "app.name")}</Text>
          <Text style={styles.subtitle}>
            {textByLocale(
              locale,
              "Review today's route, keep evidence moving, and recover safely when work has to continue offline.",
              "Revisa la ruta del dia, manten la evidencia avanzando y recupera el trabajo de forma segura cuando debas continuar sin conexion."
            )}
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>{textByLocale(locale, "Authentication", "Autenticacion")}</Text>
          {mobileSession?.profile ? (
            <View style={styles.notePanel}>
              <Text style={styles.taskTitle}>{mobileSession.profile.user.name}</Text>
              <Text style={styles.taskMeta}>{mobileSession.profile.user.email}</Text>
              <Text style={styles.taskMeta}>
                {mobileSession.profile.user.role} / {mobileSession.profile.session.provider}
              </Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => void signOut()}>
                <Text style={styles.secondaryButtonText}>{t(locale, "auth.signOut")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.notePanel}>
              <Text style={styles.taskMeta}>{t(locale, "auth.loginRequired")}</Text>
              <TouchableOpacity
                disabled={authBusy || !GOOGLE_CLIENT_ID || !request}
                style={styles.primaryButton}
                onPress={() => void startGoogleSignIn()}
              >
                <Text style={styles.primaryButtonText}>
                  {authBusy ? textByLocale(locale, "Opening Google...", "Abriendo Google...") : t(locale, "auth.signIn")}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator color="#1f7a5b" />
            <Text style={styles.loadingText}>{textByLocale(locale, "Loading route day...", "Cargando ruta del dia...")}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorPanel}>
            <Text style={styles.errorTitle}>{t(locale, "visits.mobileFallback")}</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {statusMessage ? (
          <View style={styles.successPanel}>
            <Text style={styles.successTitle}>{statusMessage}</Text>
          </View>
        ) : null}

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>{textByLocale(locale, "Live GPS capture", "Captura GPS en vivo")}</Text>
          <View style={styles.notePanel}>
            <Text style={styles.taskMeta}>
              {currentLocationSnapshot
                ? `${currentLocationSnapshot.label} - ${formatCoordinatePair(currentLocationSnapshot.latitude, currentLocationSnapshot.longitude)}`
                : textByLocale(locale, "No GPS capture yet.", "Todavia no hay captura GPS.")}
            </Text>
            <Text style={styles.syncMeta}>
              {textByLocale(locale, "Source", "Origen")}:{" "}
              {currentLocationSnapshot ? currentLocationSnapshot.source : textByLocale(locale, "Pending", "Pendiente")}
            </Text>
            <Text style={styles.syncMeta}>
              {textByLocale(locale, "Captured at", "Capturado a las")}:{" "}
              {currentLocationSnapshot?.capturedAt ?? textByLocale(locale, "Pending", "Pendiente")}
            </Text>
            <TouchableOpacity style={styles.secondaryButton} disabled={locationBusy} onPress={() => void refreshCurrentLocation()}>
              <Text style={styles.secondaryButtonText}>
                {locationBusy ? textByLocale(locale, "Refreshing GPS...", "Actualizando GPS...") : textByLocale(locale, "Refresh live GPS", "Actualizar GPS en vivo")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>{textByLocale(locale, "Pending sync queue", "Cola de sincronizacion pendiente")}</Text>
          {pendingSyncOperations.length > 0 ? (
            pendingSyncOperations.map((operation) => (
              <View key={operation.id} style={styles.syncCard}>
                <Text style={styles.syncTitle}>{formatSyncOperationLabel(locale, operation)}</Text>
                <Text style={styles.syncMeta}>
                  {operation.state} / {textByLocale(locale, "retries", "reintentos")} {operation.retryCount}
                </Text>
                <Text style={styles.syncMeta}>{formatSyncOperationDetail(locale, operation)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.syncMeta}>{textByLocale(locale, "No queued offline actions.", "No hay acciones en cola sin conexion.")}</Text>
          )}
          <TouchableOpacity disabled={syncingQueue || pendingSyncOperations.length === 0} style={styles.primaryButton} onPress={() => void syncQueuedOperationsNow("manual")}>
            <Text style={styles.primaryButtonText}>
              {syncingQueue
                ? textByLocale(locale, "Syncing queued actions...", "Sincronizando acciones en cola...")
                : textByLocale(locale, "Sync queued actions", "Sincronizar acciones en cola")}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>{t(locale, "visits.routeDay")}</Text>
          {visibleVisits.map((visit) => {
            const linkedTask = visibleTasks.find((task) => task.id === visit.taskId);
            const pointOfSale = pointsOfSale.find((item) => item.id === visit.pointOfSaleId)?.name ?? "Escazu Plaza";
            const routeProvince = formatReferenceLabel(visit.provinceId, pointOfSale);
            const routeZone = formatReferenceLabel(visit.zoneId);
            const taskEvidence = evidence.filter((item) => item.taskId === visit.taskId);
            const latestEvidence = [...taskEvidence]
              .filter((item) => item.latitude !== undefined && item.longitude !== undefined)
              .sort((left, right) => right.capturedAt.localeCompare(left.capturedAt))[0];
            const taskComments = comments.filter((item) => item.taskId === visit.taskId);
            const taskObservations = observations.filter((item) => item.taskId === visit.taskId);
            const taskConsignations = consignations.filter((item) => item.taskId === visit.taskId);
            const taskActivities = activities.filter((item) => item.taskId === visit.taskId);
            const taskExhibitions = exhibitions.filter((item) => item.taskId === visit.taskId);
            const summary = requirementSummaries.find((item) => item.taskId === visit.taskId);

            return (
              <View style={styles.taskCard} key={visit.id}>
                <View style={styles.taskHeader}>
                  <View style={styles.taskHeaderCopy}>
                    <Text style={styles.taskTitle}>{linkedTask?.title ?? visit.taskId}</Text>
                    <Text style={styles.taskMeta}>
                      {visit.scheduledFor} - {t(locale, `visitStatus.${visit.status}` as never)}
                    </Text>
                  </View>
                  <View style={styles.taskBadge}>
                    <Text style={styles.taskBadgeText}>{pointOfSale}</Text>
                  </View>
                </View>

                <View style={styles.routePanel}>
                  <Text style={styles.routeLabel}>{textByLocale(locale, "Route scope", "Alcance de ruta")}</Text>
                  <Text style={styles.routeValue}>{routeProvince} / {routeZone} / {pointOfSale}</Text>
                  <Text style={styles.routeValue}>
                    {textByLocale(locale, "Check-in", "Entrada")}: {visit.checkedInAt ?? textByLocale(locale, "Pending", "Pendiente")} {"\n"}
                    {textByLocale(locale, "Check-out", "Salida")}: {visit.checkedOutAt ?? textByLocale(locale, "Pending", "Pendiente")}
                  </Text>
                  <Text style={styles.routeValue}>
                    {textByLocale(locale, "Visit GPS", "GPS de visita")}:{" "}
                    {formatCoordinatePair(
                      visit.checkedOutLatitude ?? visit.checkedInLatitude,
                      visit.checkedOutLongitude ?? visit.checkedInLongitude
                    )}
                  </Text>
                  <Text style={styles.routeValue}>
                    {textByLocale(locale, "Latest evidence GPS", "Ultimo GPS de evidencia")}:{" "}
                    {latestEvidence ? formatCoordinatePair(latestEvidence.latitude, latestEvidence.longitude) : textByLocale(locale, "Pending", "Pendiente")}
                  </Text>
                  <Text style={styles.routeValue}>
                    {t(locale, "evidence.requirements")}: {summary?.missingTypes.length ? `${textByLocale(locale, "Missing", "Falta")} ${summary.missingTypes.join(", ")}` : textByLocale(locale, "Complete", "Completo")}
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
                            {t(locale, `evidence.type.${item.type}` as never)} - {t(locale, `uploadStatus.${item.uploadStatus}` as never)}
                          </Text>
                          <Text style={styles.syncMeta}>
                            {textByLocale(locale, "Progress", "Progreso")} {Math.round(mediaAsset?.uploadProgress ?? 0)}% / {textByLocale(locale, "chunks", "bloques")} {mediaAsset?.uploadedChunkCount ?? 0} {textByLocale(locale, "of", "de")} {mediaAsset?.chunkCount ?? 0}
                          </Text>
                          <Text style={styles.syncMeta}>
                            GPS {formatCoordinatePair(item.latitude, item.longitude)}
                          </Text>
                          <Text style={styles.syncMeta}>
                            {textByLocale(locale, "Transfer reference", "Referencia de transferencia")}{" "}
                            {mediaAsset?.uploadSessionId ?? textByLocale(locale, "pending", "pendiente")}
                          </Text>
                          <Text style={styles.syncMeta}>{textByLocale(locale, "Retry count", "Cantidad de reintentos")} {mediaAsset?.retryCount ?? 0}</Text>
                          {mediaAsset?.lastError ? <Text style={styles.errorText}>{mediaAsset.lastError}</Text> : null}
                        </View>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.notePanel}>
                  <Text style={styles.captureHeading}>{textByLocale(locale, "Notes", "Notas")}</Text>
                  {taskComments.map((item: Comment) => (
                    <Text key={item.id} style={styles.syncMeta}>
                      {t(locale, "notes.comment")}: {item.body}
                    </Text>
                  ))}
                  {taskObservations.map((item: Observation) => (
                    <Text key={item.id} style={styles.syncMeta}>
                      {t(locale, "notes.observation")}: {item.body}
                    </Text>
                  ))}
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => void addQuickComment(visit.taskId)}>
                    <Text style={styles.secondaryButtonText}>{t(locale, "notes.addComment")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => void addQuickObservation(visit.taskId)}>
                    <Text style={styles.secondaryButtonText}>{t(locale, "notes.addObservation")}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.notePanel}>
                  <Text style={styles.captureHeading}>{textByLocale(locale, "Consignations", "Consignaciones")}</Text>
                  {taskConsignations.map((item: Consignation) => (
                    <View key={item.id} style={styles.inlineActions}>
                      <Text style={styles.syncMeta}>
                        {t(locale, `consignation.status.${item.status}` as never)} / {item.preparedAt}
                      </Text>
                      <Text style={styles.syncMeta}>
                        {t(locale, "consignation.recipients")}: {consignationReviewDrafts[item.id]?.recipientEmails || "cliente@capris.example"}
                      </Text>
                      <TextInput
                        autoCapitalize="none"
                        keyboardType="email-address"
                        placeholder="cliente@capris.example"
                        placeholderTextColor="#9b8b8e"
                        style={styles.textInput}
                        value={consignationReviewDrafts[item.id]?.recipientEmails ?? ""}
                        onChangeText={(value) => updateConsignationReviewDraft(item.id, { recipientEmails: value }, setConsignationReviewDrafts)}
                      />
                      <TextInput
                        placeholder={t(locale, "consignation.subject")}
                        placeholderTextColor="#9b8b8e"
                        style={styles.textInput}
                        value={consignationReviewDrafts[item.id]?.emailSubject ?? ""}
                        onChangeText={(value) => updateConsignationReviewDraft(item.id, { emailSubject: value }, setConsignationReviewDrafts)}
                      />
                      <TextInput
                        multiline
                        placeholder={t(locale, "consignation.body")}
                        placeholderTextColor="#9b8b8e"
                        style={[styles.textInput, styles.textAreaInput]}
                        textAlignVertical="top"
                        value={consignationReviewDrafts[item.id]?.emailBody ?? ""}
                        onChangeText={(value) => updateConsignationReviewDraft(item.id, { emailBody: value }, setConsignationReviewDrafts)}
                      />
                      {item.status === "prepared" || item.status === "failed" ? (
                        <TouchableOpacity style={styles.secondaryButton} onPress={() => void reviewConsignation(item)}>
                          <Text style={styles.secondaryButtonText}>{t(locale, "consignation.review")}</Text>
                        </TouchableOpacity>
                      ) : null}
                      {item.status === "ready_to_send" ? (
                        <>
                          <TouchableOpacity style={styles.secondaryButton} onPress={() => void sendConsignation(item)}>
                            <Text style={styles.secondaryButtonText}>{t(locale, "consignation.send")}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.secondaryButton} onPress={() => void failConsignation(item)}>
                            <Text style={styles.secondaryButtonText}>{t(locale, "consignation.fail")}</Text>
                          </TouchableOpacity>
                        </>
                      ) : null}
                    </View>
                  ))}
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => void prepareConsignation(visit.taskId, visit.id)}>
                    <Text style={styles.secondaryButtonText}>{t(locale, "consignation.prepare")}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.notePanel}>
                  <Text style={styles.captureHeading}>{t(locale, "activity.activities")}</Text>
                  {taskActivities.map((item: Activity) => (
                    <Text key={item.id} style={styles.syncMeta}>
                      {item.recordedAt}: {item.quantity} {t(locale, "activity.activities").toLowerCase()}
                    </Text>
                  ))}
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => void recordActivity(visit.taskId, visit.id, visit.pointOfSaleId)}>
                    <Text style={styles.secondaryButtonText}>{t(locale, "activity.recordActivity")}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.notePanel}>
                  <Text style={styles.captureHeading}>{t(locale, "activity.exhibitions")}</Text>
                  {taskExhibitions.map((item: ExhibitionInstallation) => (
                    <Text key={item.id} style={styles.syncMeta}>
                      {item.recordedAt}: {item.quantity} {t(locale, "activity.exhibitions").toLowerCase()}
                    </Text>
                  ))}
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => void recordExhibition(visit.taskId, visit.id, visit.pointOfSaleId)}>
                    <Text style={styles.secondaryButtonText}>{t(locale, "activity.recordExhibition")}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.actions}>
                  {visit.status === "scheduled" ? (
                    <TouchableOpacity style={styles.primaryButton} onPress={() => void transitionVisit(visit, "check_in")}>
                      <Text style={styles.primaryButtonText}>{t(locale, "visits.checkIn")}</Text>
                    </TouchableOpacity>
                  ) : null}
                  {visit.status === "checked_in" ? (
                    <TouchableOpacity style={styles.primaryButton} onPress={() => void transitionVisit(visit, "check_out")}>
                      <Text style={styles.primaryButtonText}>{t(locale, "visits.checkOut")}</Text>
                    </TouchableOpacity>
                  ) : null}

                  <Text style={styles.captureHeading}>{textByLocale(locale, "Before evidence", "Evidencia antes")}</Text>
                  <CaptureActionRow
                    locale={locale}
                    cameraBusy={captureBusyKey === `${visit.taskId}:before:camera`}
                    libraryBusy={captureBusyKey === `${visit.taskId}:before:library`}
                    onCamera={() => void captureEvidence(visit.taskId, visit.id, "before", "camera")}
                    onLibrary={() => void captureEvidence(visit.taskId, visit.id, "before", "library")}
                  />

                  <Text style={styles.captureHeading}>{textByLocale(locale, "After evidence", "Evidencia despues")}</Text>
                  <CaptureActionRow
                    locale={locale}
                    cameraBusy={captureBusyKey === `${visit.taskId}:after:camera`}
                    libraryBusy={captureBusyKey === `${visit.taskId}:after:library`}
                    onCamera={() => void captureEvidence(visit.taskId, visit.id, "after", "camera")}
                    onLibrary={() => void captureEvidence(visit.taskId, visit.id, "after", "library")}
                  />

                  <Text style={styles.captureHeading}>{textByLocale(locale, "Supporting evidence", "Evidencia de apoyo")}</Text>
                  <CaptureActionRow
                    locale={locale}
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
                            <Text style={styles.primaryButtonText}>{textByLocale(locale, "Retry upload", "Reintentar carga")}</Text>
                          </TouchableOpacity>
                        ) : null}
                        {mediaAsset.uploadStatus !== "uploaded" ? (
                          <TouchableOpacity style={styles.secondaryButton} onPress={() => void updateMediaUpload(mediaAsset, "uploading")}>
                            <Text style={styles.secondaryButtonText}>{textByLocale(locale, "Resume upload", "Reanudar carga")}</Text>
                          </TouchableOpacity>
                        ) : null}
                        {mediaAsset.uploadStatus !== "failed" && mediaAsset.uploadStatus !== "uploaded" ? (
                          <TouchableOpacity style={styles.secondaryButton} onPress={() => void updateMediaUpload(mediaAsset, "failed")}>
                            <Text style={styles.secondaryButtonText}>{textByLocale(locale, "Mark sync failed", "Marcar sincronizacion fallida")}</Text>
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
          <Text style={styles.sectionTitle}>{textByLocale(locale, "Assigned tasks", "Tareas asignadas")}</Text>
          {visibleTasks.map((task) => {
            const pointOfSale = pointsOfSale.find((item) => item.id === task.pointOfSaleId)?.name ?? "Escazu Plaza";
            const routeProvince = formatReferenceLabel(task.provinceId, pointOfSale);
            const routeZone = formatReferenceLabel(task.zoneId);
            const summary = requirementSummaries.find((item) => item.taskId === task.id);

            return (
              <View style={styles.taskCard} key={task.id}>
                <View style={styles.taskHeader}>
                  <View style={styles.taskHeaderCopy}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    <Text style={styles.taskMeta}>
                      {task.scheduledFor} - {t(locale, `status.${task.status}` as never)}
                    </Text>
                  </View>
                  <View style={styles.taskBadge}>
                    <Text style={styles.taskBadgeText}>{t(locale, `priority.${task.priority}` as never)}</Text>
                  </View>
                </View>

                <View style={styles.routePanel}>
                  <Text style={styles.routeLabel}>{textByLocale(locale, "Route scope", "Alcance de ruta")}</Text>
                  <Text style={styles.routeValue}>{routeProvince} / {routeZone} / {pointOfSale}</Text>
                  <Text style={styles.routeValue}>
                    {t(locale, "evidence.requirements")}: {summary?.missingTypes.length ? summary.missingTypes.join(", ") : textByLocale(locale, "Complete", "Completo")}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => void loadRouteDay()}>
            <Text style={styles.primaryButtonText}>{textByLocale(locale, "Refresh route day", "Actualizar ruta del dia")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CaptureActionRow({
  locale,
  cameraBusy,
  libraryBusy,
  onCamera,
  onLibrary
}: {
  locale: Locale;
  cameraBusy: boolean;
  libraryBusy: boolean;
  onCamera: () => void;
  onLibrary: () => void;
}) {
  return (
    <View style={styles.captureRow}>
      <TouchableOpacity disabled={cameraBusy || libraryBusy} style={styles.primaryButton} onPress={onCamera}>
        <Text style={styles.primaryButtonText}>{cameraBusy ? textByLocale(locale, "Opening camera...", "Abriendo camara...") : textByLocale(locale, "Use camera", "Usar camara")}</Text>
      </TouchableOpacity>
      <TouchableOpacity disabled={cameraBusy || libraryBusy} style={styles.secondaryButton} onPress={onLibrary}>
        <Text style={styles.secondaryButtonText}>{libraryBusy ? textByLocale(locale, "Opening library...", "Abriendo galeria...") : textByLocale(locale, "Use library", "Usar galeria")}</Text>
      </TouchableOpacity>
    </View>
  );
}

function formatSyncOperationLabel(locale: Locale, operation: SyncOperation) {
  switch (operation.type) {
    case "visit_check_in":
      return textByLocale(locale, "Visit check-in", "Entrada de visita");
    case "visit_check_out":
      return textByLocale(locale, "Visit check-out", "Salida de visita");
    case "photo_upload":
      return textByLocale(locale, "Evidence upload", "Carga de evidencia");
    case "comment_create":
      return textByLocale(locale, "Comment", "Comentario");
    case "observation_create":
      return textByLocale(locale, "Observation", "Observacion");
    case "consignation_prepare":
      return textByLocale(locale, "Consignation prepare", "Preparar consignacion");
    case "consignation_review":
      return textByLocale(locale, "Consignation review", "Revision de consignacion");
    case "consignation_send":
      return textByLocale(locale, "Consignation send", "Envio de consignacion");
    case "consignation_fail":
      return textByLocale(locale, "Consignation failure", "Falla de consignacion");
    case "activity_create":
      return textByLocale(locale, "Activity record", "Registro de actividad");
    case "exhibition_create":
      return textByLocale(locale, "Exhibition record", "Registro de exhibicion");
    default:
      return operation.type;
  }
}

function formatSyncOperationDetail(locale: Locale, operation: SyncOperation) {
  switch (operation.type) {
    case "visit_check_in":
    case "visit_check_out": {
      const payload = operation.payload as VisitCheckInSyncPayload | VisitCheckOutSyncPayload;
      return `${textByLocale(locale, "Visit", "Visita")} ${payload.visitId}`;
    }
    case "photo_upload": {
      const payload = operation.payload as PhotoUploadSyncPayload;
      return payload.uploadRequest.fileName;
    }
    case "comment_create": {
      const payload = operation.payload as CommentCreateSyncPayload;
      return `${textByLocale(locale, "Task", "Tarea")} ${payload.taskId}`;
    }
    case "observation_create": {
      const payload = operation.payload as ObservationCreateSyncPayload;
      return `${textByLocale(locale, "Task", "Tarea")} ${payload.taskId}`;
    }
    case "consignation_prepare": {
      const payload = operation.payload as ConsignationPrepareSyncPayload;
      return `${textByLocale(locale, "Task", "Tarea")} ${payload.taskId}`;
    }
    case "consignation_review":
    case "consignation_send":
    case "consignation_fail": {
      const payload = operation.payload as ConsignationReviewSyncPayload | ConsignationSendSyncPayload | ConsignationFailSyncPayload;
      return `${textByLocale(locale, "Consignation", "Consignacion")} ${payload.consignationId}`;
    }
    case "activity_create": {
      const payload = operation.payload as ActivityCreateSyncPayload;
      return `${textByLocale(locale, "Task", "Tarea")} ${payload.taskId}`;
    }
    case "exhibition_create": {
      const payload = operation.payload as ExhibitionCreateSyncPayload;
      return `${textByLocale(locale, "Task", "Tarea")} ${payload.taskId}`;
    }
    default:
      return operation.id;
  }
}

function createFallbackBootstrap(): EvidenceBootstrap {
  return {
    activities: [],
    clients: [],
    evidence: [],
    exhibitions: [],
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

function formatCoordinatePair(latitude?: number, longitude?: number) {
  if (latitude === undefined || longitude === undefined) {
    return "--";
  }

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function formatReferenceLabel(referenceId: string, fallback = "") {
  if (!referenceId) {
    return fallback || "--";
  }

  const compact = referenceId.replace(/^province_/, "").replace(/^zone_/, "").replace(/^pos_/, "");
  return compact
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function buildConsignationReviewDrafts(
  consignations: Consignation[],
  tasks: Task[],
  clients: Client[],
  evidence: EvidencePhoto[]
) {
  return Object.fromEntries(
    consignations.map((consignation) => [
      consignation.id,
      buildConsignationReviewDraft(consignation, tasks, clients, evidence)
    ])
  );
}

function buildConsignationReviewDraft(
  consignation: Consignation,
  tasks: Task[],
  clients: Client[],
  evidence: EvidencePhoto[]
): ConsignationReviewDraft {
  const linkedTask = tasks.find((task) => task.id === consignation.taskId);
  const linkedClient = clients.find((client) => client.id === linkedTask?.clientId);
  const beforeEvidence = evidence.find((item) => item.taskId === consignation.taskId && item.type === "before");
  const afterEvidence = evidence.find((item) => item.taskId === consignation.taskId && item.type === "after");

  return {
    recipientEmails: consignation.recipientEmails.join(", ") || linkedClient?.contactEmail || "cliente@capris.example",
    emailSubject: consignation.emailSubject ?? `Consignation evidence for ${linkedTask?.title ?? consignation.taskId}`,
    emailBody:
      consignation.emailBody ??
      `Attached are the before and after consignation photos for ${linkedTask?.title ?? consignation.taskId}.`,
    beforeEvidenceId: consignation.beforeEvidenceId ?? beforeEvidence?.id,
    afterEvidenceId: consignation.afterEvidenceId ?? afterEvidence?.id
  };
}

function updateConsignationReviewDraft(
  consignationId: string,
  patch: Partial<ConsignationReviewDraft>,
  setDrafts: Dispatch<SetStateAction<Record<string, ConsignationReviewDraft>>>
) {
  setDrafts((current) => ({
    ...current,
    [consignationId]: {
      ...current[consignationId],
      ...patch
    }
  }));
}

function applyPendingOperationsToBootstrap(base: EvidenceBootstrap, operations: SyncOperation[]): EvidenceBootstrap {
  const next: EvidenceBootstrap = {
    ...base,
    activities: [...base.activities],
    clients: [...base.clients],
    evidence: [...base.evidence],
    exhibitions: [...base.exhibitions],
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
        preparedAt: payload.preparedAt,
        recipientEmails: []
      });
    } else if (operation.type === "consignation_review") {
      const payload = operation.payload as ConsignationReviewSyncPayload;
      const targetId = payload.localConsignationId ?? payload.consignationId;
      next.consignations = next.consignations.map((item) =>
        item.id === targetId
          ? {
              ...item,
              status: "ready_to_send",
              reviewedAt: payload.reviewedAt,
              recipientEmails: payload.recipientEmails,
              emailSubject: payload.emailSubject,
              emailBody: payload.emailBody,
              beforeEvidenceId: payload.beforeEvidenceId,
              afterEvidenceId: payload.afterEvidenceId
            }
          : item
      );
    } else if (operation.type === "consignation_fail") {
      const payload = operation.payload as ConsignationFailSyncPayload;
      const targetId = payload.localConsignationId ?? payload.consignationId;
      next.consignations = next.consignations.map((item) =>
        item.id === targetId
          ? {
              ...item,
              status: "failed",
              failedAt: payload.failedAt,
              sendFailureReason: payload.reason
            }
          : item
      );
    } else if (operation.type === "consignation_send") {
      const payload = operation.payload as ConsignationSendSyncPayload;
      const targetId = payload.localConsignationId ?? payload.consignationId;
      next.consignations = next.consignations.map((item) =>
        item.id === targetId ? { ...item, status: "sent", sentAt: payload.sentAt } : item
      );
    } else if (operation.type === "activity_create") {
      const payload = operation.payload as ActivityCreateSyncPayload;
      upsertActivity(next, {
        id: `activity_local_${operation.id}`,
        organizationId: payload.organizationId,
        taskId: payload.taskId,
        userId: payload.userId,
        visitId: payload.visitId,
        pointOfSaleId: payload.pointOfSaleId,
        quantity: payload.quantity,
        note: payload.note,
        recordedAt: payload.recordedAt
      });
    } else if (operation.type === "exhibition_create") {
      const payload = operation.payload as ExhibitionCreateSyncPayload;
      upsertExhibition(next, {
        id: `exhibition_local_${operation.id}`,
        organizationId: payload.organizationId,
        taskId: payload.taskId,
        userId: payload.userId,
        visitId: payload.visitId,
        pointOfSaleId: payload.pointOfSaleId,
        quantity: payload.quantity,
        note: payload.note,
        recordedAt: payload.recordedAt
      });
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

function upsertActivity(bootstrap: EvidenceBootstrap, activity: Activity) {
  const index = bootstrap.activities.findIndex((item) => item.id === activity.id);
  if (index >= 0) {
    bootstrap.activities[index] = activity;
  } else {
    bootstrap.activities.unshift(activity);
  }
}

function upsertExhibition(bootstrap: EvidenceBootstrap, exhibition: ExhibitionInstallation) {
  const index = bootstrap.exhibitions.findIndex((item) => item.id === exhibition.id);
  if (index >= 0) {
    bootstrap.exhibitions[index] = exhibition;
  } else {
    bootstrap.exhibitions.unshift(exhibition);
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
  textInput: {
    backgroundColor: "#ffffff",
    borderColor: "#e3c4c9",
    borderRadius: 8,
    borderWidth: 1,
    color: "#251b1d",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  textAreaInput: {
    minHeight: 96
  },
  captureRow: { gap: 10 },
  primaryButton: { alignItems: "center", backgroundColor: "#c5333f", borderRadius: 8, padding: 14 },
  primaryButtonText: { color: "#ffffff", fontWeight: "700" },
  secondaryButton: { alignItems: "center", borderColor: "#c5333f", borderRadius: 8, borderWidth: 1, padding: 14 },
  secondaryButtonText: { color: "#c5333f", fontWeight: "700" }
});

