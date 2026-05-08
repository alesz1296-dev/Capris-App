"use client";

import { useEffect, useState, useTransition } from "react";
import type { ReactNode } from "react";
import type {
  ActivityType,
  CatalogBootstrap,
  Client,
  CreateActivityTypeInput,
  CreateClientInput,
  CreatePointOfSaleInput,
  CreateProvinceInput,
  CreateTaskTypeInput,
  CreateWorkflowRuleInput,
  CreateZoneInput,
  PointOfSale,
  Province,
  TaskType,
  WorkflowRule,
  Zone
} from "@capris/shared";

const ORGANIZATION_ID = "org_capris";

type CatalogStatus = "active" | "inactive";

type ProvinceFormState = {
  name: string;
  code: string;
};

type ZoneFormState = {
  name: string;
  code: string;
  provinceId: string;
};

type ClientFormState = {
  name: string;
  code: string;
  contactEmail: string;
};

type PointOfSaleFormState = {
  name: string;
  code: string;
  provinceId: string;
  zoneId: string;
  clientId: string;
  address: string;
};

type TypeFormState = {
  name: string;
  code: string;
};

type WorkflowFormState = {
  taskTypeId: string;
  activityTypeId: string;
  requiresBeforePhoto: boolean;
  requiresAfterPhoto: boolean;
  requiresGps: boolean;
  requiresComment: boolean;
  requiresSupervisorApproval: boolean;
  requiresConsignationEmail: boolean;
};

function statusLabel(active: boolean): CatalogStatus {
  return active ? "active" : "inactive";
}

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
}

const CREATE_LABELS: Record<string, string> = {
  provinces: "Province",
  zones: "Zone",
  clients: "Client",
  "points-of-sale": "Point of sale",
  "activity-types": "Activity type",
  "task-types": "Task type",
  "workflow-rules": "Workflow rule"
};

const ARCHIVE_LABELS: Record<string, string> = {
  provinces: "Province",
  zones: "Zone",
  clients: "Client",
  "points-of-sale": "Point of sale",
  "activity-types": "Activity type",
  "task-types": "Task type",
  "workflow-rules": "Workflow rule"
};

export function CatalogAdmin() {
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [workflowRules, setWorkflowRules] = useState<WorkflowRule[]>([]);

  const [provinceForm, setProvinceForm] = useState<ProvinceFormState>({ name: "", code: "" });
  const [zoneForm, setZoneForm] = useState<ZoneFormState>({ name: "", code: "", provinceId: "" });
  const [clientForm, setClientForm] = useState<ClientFormState>({ name: "", code: "", contactEmail: "" });
  const [pointOfSaleForm, setPointOfSaleForm] = useState<PointOfSaleFormState>({
    name: "",
    code: "",
    provinceId: "",
    zoneId: "",
    clientId: "",
    address: ""
  });
  const [activityTypeForm, setActivityTypeForm] = useState<TypeFormState>({ name: "", code: "" });
  const [taskTypeForm, setTaskTypeForm] = useState<TypeFormState>({ name: "", code: "" });
  const [workflowForm, setWorkflowForm] = useState<WorkflowFormState>({
    taskTypeId: "",
    activityTypeId: "",
    requiresBeforePhoto: true,
    requiresAfterPhoto: true,
    requiresGps: true,
    requiresComment: false,
    requiresSupervisorApproval: false,
    requiresConsignationEmail: false
  });

  const activeProvinces = provinces.filter((province) => province.active);
  const activeZones = zones.filter((zone) => zone.active);
  const activeClients = clients.filter((client) => client.active);
  const activeTaskTypes = taskTypes.filter((taskType) => taskType.active);
  const activeActivityTypes = activityTypes.filter((activityType) => activityType.active);
  const zonesForSelectedProvince = activeZones.filter((zone) => zone.provinceId === pointOfSaleForm.provinceId);
  const actionDisabled = loading || isPending;

  useEffect(() => {
    void loadCatalogs();
  }, []);

  useEffect(() => {
    if (!zoneForm.provinceId && activeProvinces[0]) {
      setZoneForm((current) => ({ ...current, provinceId: activeProvinces[0].id }));
    }

    if (!pointOfSaleForm.provinceId && activeProvinces[0]) {
      setPointOfSaleForm((current) => ({ ...current, provinceId: activeProvinces[0].id }));
    }
  }, [activeProvinces, pointOfSaleForm.provinceId, zoneForm.provinceId]);

  useEffect(() => {
    const hasValidZone = zonesForSelectedProvince.some((zone) => zone.id === pointOfSaleForm.zoneId);
    if (!hasValidZone) {
      setPointOfSaleForm((current) => ({ ...current, zoneId: zonesForSelectedProvince[0]?.id ?? "" }));
    }
  }, [pointOfSaleForm.zoneId, zonesForSelectedProvince]);

  useEffect(() => {
    const hasValidClient = activeClients.some((client) => client.id === pointOfSaleForm.clientId);
    if (!hasValidClient) {
      setPointOfSaleForm((current) => ({ ...current, clientId: activeClients[0]?.id ?? "" }));
    }
  }, [activeClients, pointOfSaleForm.clientId]);

  useEffect(() => {
    const hasValidTaskType = activeTaskTypes.some((taskType) => taskType.id === workflowForm.taskTypeId);
    const hasValidActivityType = activeActivityTypes.some(
      (activityType) => activityType.id === workflowForm.activityTypeId
    );

    if (!hasValidTaskType || !hasValidActivityType) {
      setWorkflowForm((current) => ({
        ...current,
        taskTypeId: hasValidTaskType ? current.taskTypeId : activeTaskTypes[0]?.id ?? "",
        activityTypeId: hasValidActivityType ? current.activityTypeId : activeActivityTypes[0]?.id ?? ""
      }));
    }
  }, [activeActivityTypes, activeTaskTypes, workflowForm.activityTypeId, workflowForm.taskTypeId]);

  async function loadCatalogs() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${getApiBaseUrl()}/catalogs/bootstrap`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`Catalog bootstrap failed with status ${response.status}.`);
      }

      const data = (await response.json()) as CatalogBootstrap;
      setCatalogState(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load catalogs.");
    } finally {
      setLoading(false);
    }
  }

  function setCatalogState(data: CatalogBootstrap) {
    setProvinces(data.provinces);
    setZones(data.zones);
    setClients(data.clients);
    setPointsOfSale(data.pointsOfSale);
    setActivityTypes(data.activityTypes);
    setTaskTypes(data.taskTypes);
    setWorkflowRules(data.workflowRules);
  }

  async function submitCreate<TInput>(path: string, body: TInput, onSuccess: () => void) {
    try {
      setStatusMessage(null);
      setError(null);

      const response = await fetch(`${getApiBaseUrl()}/catalogs/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, `Create request for ${path} failed.`));
      }

      onSuccess();
      setStatusMessage(`${CREATE_LABELS[path]} created successfully.`);
      startTransition(() => {
        void loadCatalogs();
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : `Unable to create ${path}.`);
    }
  }

  async function archiveItem(path: string, id: string) {
    try {
      setStatusMessage(null);
      setError(null);

      const response = await fetch(`${getApiBaseUrl()}/catalogs/${path}/${id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, `Archive request for ${path}/${id} failed.`));
      }

      setStatusMessage(`${ARCHIVE_LABELS[path]} archived successfully.`);
      startTransition(() => {
        void loadCatalogs();
      });
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : `Unable to archive ${path}.`);
    }
  }

  function handleProvinceCreate() {
    if (!provinceForm.name.trim() || !provinceForm.code.trim()) {
      return;
    }

    const payload: CreateProvinceInput = {
      organizationId: ORGANIZATION_ID,
      name: provinceForm.name.trim(),
      code: provinceForm.code.trim().toUpperCase(),
      active: true
    };

    void submitCreate("provinces", payload, () => {
      setProvinceForm({ name: "", code: "" });
    });
  }

  function handleZoneCreate() {
    if (!zoneForm.name.trim() || !zoneForm.code.trim() || !zoneForm.provinceId) {
      return;
    }

    const payload: CreateZoneInput = {
      organizationId: ORGANIZATION_ID,
      provinceId: zoneForm.provinceId,
      name: zoneForm.name.trim(),
      code: zoneForm.code.trim().toUpperCase(),
      active: true
    };

    void submitCreate("zones", payload, () => {
      setZoneForm((current) => ({ ...current, name: "", code: "" }));
    });
  }

  function handleClientCreate() {
    if (!clientForm.name.trim() || !clientForm.code.trim()) {
      return;
    }

    const payload: CreateClientInput = {
      organizationId: ORGANIZATION_ID,
      name: clientForm.name.trim(),
      code: clientForm.code.trim().toUpperCase(),
      contactEmail: clientForm.contactEmail.trim() || undefined,
      active: true
    };

    void submitCreate("clients", payload, () => {
      setClientForm({ name: "", code: "", contactEmail: "" });
    });
  }

  function handlePointOfSaleCreate() {
    if (
      !pointOfSaleForm.name.trim() ||
      !pointOfSaleForm.code.trim() ||
      !pointOfSaleForm.provinceId ||
      !pointOfSaleForm.zoneId ||
      !pointOfSaleForm.clientId
    ) {
      return;
    }

    const payload: CreatePointOfSaleInput = {
      organizationId: ORGANIZATION_ID,
      provinceId: pointOfSaleForm.provinceId,
      zoneId: pointOfSaleForm.zoneId,
      clientId: pointOfSaleForm.clientId,
      name: pointOfSaleForm.name.trim(),
      code: pointOfSaleForm.code.trim().toUpperCase(),
      address: pointOfSaleForm.address.trim() || undefined,
      active: true
    };

    void submitCreate("points-of-sale", payload, () => {
      setPointOfSaleForm((current) => ({ ...current, name: "", code: "", address: "" }));
    });
  }

  function handleActivityTypeCreate() {
    if (!activityTypeForm.name.trim() || !activityTypeForm.code.trim()) {
      return;
    }

    const payload: CreateActivityTypeInput = {
      organizationId: ORGANIZATION_ID,
      name: activityTypeForm.name.trim(),
      code: activityTypeForm.code.trim().toUpperCase(),
      active: true
    };

    void submitCreate("activity-types", payload, () => {
      setActivityTypeForm({ name: "", code: "" });
    });
  }

  function handleTaskTypeCreate() {
    if (!taskTypeForm.name.trim() || !taskTypeForm.code.trim()) {
      return;
    }

    const payload: CreateTaskTypeInput = {
      organizationId: ORGANIZATION_ID,
      name: taskTypeForm.name.trim(),
      code: taskTypeForm.code.trim().toUpperCase(),
      active: true
    };

    void submitCreate("task-types", payload, () => {
      setTaskTypeForm({ name: "", code: "" });
    });
  }

  function handleWorkflowRuleCreate() {
    if (!workflowForm.taskTypeId || !workflowForm.activityTypeId) {
      return;
    }

    const payload: CreateWorkflowRuleInput = {
      organizationId: ORGANIZATION_ID,
      taskTypeId: workflowForm.taskTypeId,
      activityTypeId: workflowForm.activityTypeId,
      requiresBeforePhoto: workflowForm.requiresBeforePhoto,
      requiresAfterPhoto: workflowForm.requiresAfterPhoto,
      requiresGps: workflowForm.requiresGps,
      requiresComment: workflowForm.requiresComment,
      requiresSupervisorApproval: workflowForm.requiresSupervisorApproval,
      requiresConsignationEmail: workflowForm.requiresConsignationEmail
    };

    void submitCreate("workflow-rules", payload, () => undefined);
  }

  return (
    <section className="catalogSection" id="routes">
      <div className="sectionHeading">
        <p className="eyebrow">Catalogs</p>
        <h2>Catalog admin forms for geography, customers, and execution rules</h2>
        <p className="sectionDescription">
          This surface now uses the live catalog API for Session 5. Create and archive actions refresh from durable
          backend data.
        </p>
        <button className="secondaryAction sectionAction" disabled={actionDisabled} type="button" onClick={() => void loadCatalogs()}>
          {actionDisabled ? "Refreshing..." : "Refresh catalogs"}
        </button>
      </div>

      <div className="catalogFeedbackRow">
        {loading ? <p className="feedbackInfo">Loading catalog data...</p> : null}
        {isPending ? <p className="feedbackInfo">Refreshing from API...</p> : null}
        {statusMessage ? <p className="feedbackSuccess">{statusMessage}</p> : null}
        {error ? <p className="feedbackError">{error}</p> : null}
      </div>

      <div className="catalogAdminLayout">
        <CatalogPanel
          title="Provinces"
          description="Maintain Costa Rica province records used by zones, visits, and routing."
          form={
            <FormGrid>
              <label>
                <span>Name</span>
                <input
                  value={provinceForm.name}
                  onChange={(event) => setProvinceForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Heredia"
                />
              </label>
              <label>
                <span>Code</span>
                <input
                  value={provinceForm.code}
                  onChange={(event) => setProvinceForm((current) => ({ ...current, code: event.target.value }))}
                  placeholder="HE"
                />
              </label>
              <button
                className="primaryAction"
                disabled={actionDisabled}
                type="button"
                onClick={handleProvinceCreate}
              >
                {actionDisabled ? "Saving..." : "Add province"}
              </button>
            </FormGrid>
          }
          actionDisabled={actionDisabled}
          items={provinces.map((province) => ({
            id: province.id,
            label: `${province.name} (${province.code}) - ${statusLabel(province.active)}`,
            archived: !province.active,
            onArchive: () => void archiveItem("provinces", province.id)
          }))}
        />

        <CatalogPanel
          title="Zones"
          description="Group points of sale into operational route territories."
          form={
            <FormGrid>
              <label>
                <span>Province</span>
                <select
                  value={zoneForm.provinceId}
                  onChange={(event) => setZoneForm((current) => ({ ...current, provinceId: event.target.value }))}
                >
                  {activeProvinces.map((province) => (
                    <option key={province.id} value={province.id}>
                      {province.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Name</span>
                <input
                  value={zoneForm.name}
                  onChange={(event) => setZoneForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="East"
                />
              </label>
              <label>
                <span>Code</span>
                <input
                  value={zoneForm.code}
                  onChange={(event) => setZoneForm((current) => ({ ...current, code: event.target.value }))}
                  placeholder="EAST"
                />
              </label>
              <button className="primaryAction" disabled={actionDisabled} type="button" onClick={handleZoneCreate}>
                {actionDisabled ? "Saving..." : "Add zone"}
              </button>
            </FormGrid>
          }
          actionDisabled={actionDisabled}
          items={zones.map((zone) => ({
            id: zone.id,
            label: `${zone.name} (${zone.code}) - ${statusLabel(zone.active)}`,
            archived: !zone.active,
            onArchive: () => void archiveItem("zones", zone.id)
          }))}
        />

        <CatalogPanel
          title="Clients"
          description="Track retail clients and their operational contact points."
          form={
            <FormGrid>
              <label>
                <span>Name</span>
                <input
                  value={clientForm.name}
                  onChange={(event) => setClientForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Pricesmart"
                />
              </label>
              <label>
                <span>Code</span>
                <input
                  value={clientForm.code}
                  onChange={(event) => setClientForm((current) => ({ ...current, code: event.target.value }))}
                  placeholder="PRICESMART"
                />
              </label>
              <label className="fullWidth">
                <span>Contact email</span>
                <input
                  value={clientForm.contactEmail}
                  onChange={(event) =>
                    setClientForm((current) => ({ ...current, contactEmail: event.target.value }))
                  }
                  placeholder="ops@client.example"
                />
              </label>
              <button className="primaryAction" disabled={actionDisabled} type="button" onClick={handleClientCreate}>
                {actionDisabled ? "Saving..." : "Add client"}
              </button>
            </FormGrid>
          }
          actionDisabled={actionDisabled}
          items={clients.map((client) => ({
            id: client.id,
            label: `${client.name} (${client.code}) - ${statusLabel(client.active)}`,
            archived: !client.active,
            onArchive: () => void archiveItem("clients", client.id)
          }))}
        />

        <CatalogPanel
          title="Points of sale"
          description="Set the stores the field team will visit, report on, and validate by zone."
          form={
            <FormGrid>
              <label>
                <span>Province</span>
                <select
                  value={pointOfSaleForm.provinceId}
                  onChange={(event) =>
                    setPointOfSaleForm((current) => ({ ...current, provinceId: event.target.value }))
                  }
                >
                  {activeProvinces.map((province) => (
                    <option key={province.id} value={province.id}>
                      {province.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Zone</span>
                <select
                  value={pointOfSaleForm.zoneId}
                  onChange={(event) =>
                    setPointOfSaleForm((current) => ({ ...current, zoneId: event.target.value }))
                  }
                >
                  {zonesForSelectedProvince.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Client</span>
                <select
                  value={pointOfSaleForm.clientId}
                  onChange={(event) =>
                    setPointOfSaleForm((current) => ({ ...current, clientId: event.target.value }))
                  }
                >
                  {activeClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Name</span>
                <input
                  value={pointOfSaleForm.name}
                  onChange={(event) => setPointOfSaleForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Lindora"
                />
              </label>
              <label>
                <span>Code</span>
                <input
                  value={pointOfSaleForm.code}
                  onChange={(event) => setPointOfSaleForm((current) => ({ ...current, code: event.target.value }))}
                  placeholder="LINDORA-001"
                />
              </label>
              <label className="fullWidth">
                <span>Address</span>
                <input
                  value={pointOfSaleForm.address}
                  onChange={(event) =>
                    setPointOfSaleForm((current) => ({ ...current, address: event.target.value }))
                  }
                  placeholder="Lindora, Santa Ana"
                />
              </label>
              <button
                className="primaryAction"
                disabled={actionDisabled}
                type="button"
                onClick={handlePointOfSaleCreate}
              >
                {actionDisabled ? "Saving..." : "Add point of sale"}
              </button>
            </FormGrid>
          }
          actionDisabled={actionDisabled}
          items={pointsOfSale.map((point) => ({
            id: point.id,
            label: `${point.name} (${point.code}) - ${statusLabel(point.active)}`,
            archived: !point.active,
            onArchive: () => void archiveItem("points-of-sale", point.id)
          }))}
        />

        <CatalogPanel
          title="Activity types"
          description="Define the kind of field work being carried out at the point of sale."
          form={
            <FormGrid>
              <label>
                <span>Name</span>
                <input
                  value={activityTypeForm.name}
                  onChange={(event) =>
                    setActivityTypeForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Sampling"
                />
              </label>
              <label>
                <span>Code</span>
                <input
                  value={activityTypeForm.code}
                  onChange={(event) =>
                    setActivityTypeForm((current) => ({ ...current, code: event.target.value }))
                  }
                  placeholder="SAMPLING"
                />
              </label>
              <button
                className="primaryAction"
                disabled={actionDisabled}
                type="button"
                onClick={handleActivityTypeCreate}
              >
                {actionDisabled ? "Saving..." : "Add activity type"}
              </button>
            </FormGrid>
          }
          actionDisabled={actionDisabled}
          items={activityTypes.map((activityType) => ({
            id: activityType.id,
            label: `${activityType.name} (${activityType.code}) - ${statusLabel(activityType.active)}`,
            archived: !activityType.active,
            onArchive: () => void archiveItem("activity-types", activityType.id)
          }))}
        />

        <CatalogPanel
          title="Task types"
          description="Define the assignment container supervisors schedule and field users execute."
          form={
            <FormGrid>
              <label>
                <span>Name</span>
                <input
                  value={taskTypeForm.name}
                  onChange={(event) => setTaskTypeForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Audit"
                />
              </label>
              <label>
                <span>Code</span>
                <input
                  value={taskTypeForm.code}
                  onChange={(event) => setTaskTypeForm((current) => ({ ...current, code: event.target.value }))}
                  placeholder="AUDIT"
                />
              </label>
              <button className="primaryAction" disabled={actionDisabled} type="button" onClick={handleTaskTypeCreate}>
                {actionDisabled ? "Saving..." : "Add task type"}
              </button>
            </FormGrid>
          }
          actionDisabled={actionDisabled}
          items={taskTypes.map((taskType) => ({
            id: taskType.id,
            label: `${taskType.name} (${taskType.code}) - ${statusLabel(taskType.active)}`,
            archived: !taskType.active,
            onArchive: () => void archiveItem("task-types", taskType.id)
          }))}
        />

        <CatalogPanel
          title="Workflow rules"
          description="Configure evidence, GPS, comments, approvals, and consignation email behavior per execution combination."
          form={
            <div className="workflowForm">
              <FormGrid>
                <label>
                  <span>Task type</span>
                  <select
                    value={workflowForm.taskTypeId}
                    onChange={(event) =>
                      setWorkflowForm((current) => ({ ...current, taskTypeId: event.target.value }))
                    }
                  >
                    {activeTaskTypes.map((taskType) => (
                      <option key={taskType.id} value={taskType.id}>
                        {taskType.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Activity type</span>
                  <select
                    value={workflowForm.activityTypeId}
                    onChange={(event) =>
                      setWorkflowForm((current) => ({ ...current, activityTypeId: event.target.value }))
                    }
                  >
                    {activeActivityTypes.map((activityType) => (
                      <option key={activityType.id} value={activityType.id}>
                        {activityType.name}
                      </option>
                    ))}
                  </select>
                </label>
              </FormGrid>
              <div className="toggleGrid">
                <CheckboxRow
                  label="Before photo"
                  checked={workflowForm.requiresBeforePhoto}
                  onChange={(checked) => setWorkflowForm((current) => ({ ...current, requiresBeforePhoto: checked }))}
                />
                <CheckboxRow
                  label="After photo"
                  checked={workflowForm.requiresAfterPhoto}
                  onChange={(checked) => setWorkflowForm((current) => ({ ...current, requiresAfterPhoto: checked }))}
                />
                <CheckboxRow
                  label="GPS"
                  checked={workflowForm.requiresGps}
                  onChange={(checked) => setWorkflowForm((current) => ({ ...current, requiresGps: checked }))}
                />
                <CheckboxRow
                  label="Comment"
                  checked={workflowForm.requiresComment}
                  onChange={(checked) => setWorkflowForm((current) => ({ ...current, requiresComment: checked }))}
                />
                <CheckboxRow
                  label="Supervisor approval"
                  checked={workflowForm.requiresSupervisorApproval}
                  onChange={(checked) =>
                    setWorkflowForm((current) => ({ ...current, requiresSupervisorApproval: checked }))
                  }
                />
                <CheckboxRow
                  label="Consignation email"
                  checked={workflowForm.requiresConsignationEmail}
                  onChange={(checked) =>
                    setWorkflowForm((current) => ({ ...current, requiresConsignationEmail: checked }))
                  }
                />
              </div>
              <button
                className="primaryAction"
                disabled={actionDisabled}
                type="button"
                onClick={handleWorkflowRuleCreate}
              >
                {actionDisabled ? "Saving..." : "Add workflow rule"}
              </button>
            </div>
          }
          actionDisabled={actionDisabled}
          items={workflowRules.map((rule) => {
            const taskType = taskTypes.find((item) => item.id === rule.taskTypeId)?.name ?? "Any task";
            const activityType =
              activityTypes.find((item) => item.id === rule.activityTypeId)?.name ?? "Any activity";

            return {
              id: rule.id,
              label: `${taskType} / ${activityType} - photos:${rule.requiresBeforePhoto && rule.requiresAfterPhoto ? "required" : "partial"} gps:${rule.requiresGps ? "yes" : "no"}`,
              onArchive: () => void archiveItem("workflow-rules", rule.id)
            };
          })}
        />
      </div>
    </section>
  );
}

function CatalogPanel({
  title,
  description,
  form,
  items,
  actionDisabled
}: {
  title: string;
  description: string;
  form: ReactNode;
  items: Array<{
    id: string;
    label: string;
    onArchive: () => void;
    archived?: boolean;
  }>;
  actionDisabled?: boolean;
}) {
  return (
    <article className="catalogManagerCard">
      <div className="catalogManagerHeader">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      {form}
      {items.length > 0 ? (
        <ul className="catalogItems">
          {items.map((item) => (
            <li className="catalogItemRow" key={item.id}>
              <span>{item.label}</span>
              <button
                className="secondaryAction"
                disabled={actionDisabled || item.archived}
                type="button"
                onClick={item.onArchive}
              >
                {item.archived ? "Archived" : "Archive"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="catalogEmptyState">No catalog records yet.</p>
      )}
    </article>
  );
}

function FormGrid({ children }: { children: ReactNode }) {
  return <div className="formGrid">{children}</div>;
}

function CheckboxRow({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="checkboxRow">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

async function extractErrorMessage(response: Response, fallback: string) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(payload.message)) {
      return payload.message.join(" ");
    }

    if (payload.message) {
      return payload.message;
    }
  }

  const text = await response.text();
  return text || fallback;
}
