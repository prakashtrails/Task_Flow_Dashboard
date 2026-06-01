import React, {
  useState,
  useEffect,
  useReducer,
  useContext,
  useMemo,
  useCallback,
  createContext,
} from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Home,
  ListChecks,
  CheckSquare,
  GitBranch,
  Bell,
  Plus,
  X,
  ChevronDown,
  Lock,
  Clock,
  AlertTriangle,
  CheckCircle2,
  LayoutGrid,
  List as ListIcon,
  ArrowRight,
  MessageSquarePlus,
  ThumbsUp,
  RotateCcw,
  Trash2,
  Tag as TagIcon,
  CornerDownRight,
} from "lucide-react";

/* =====================================================================
   THEME / CONSTANTS
   ===================================================================== */

const COLORS = {
  bg: "#0F1117",
  surface: "#1A1D27",
  elevated: "#22263A",
  border: "#2E3350",
  primary: "#6C8EF5",
  text: "#E8EAF6",
  muted: "#7B82A8",
};

const PRIORITY_COLORS = {
  Low: "#4CAF50",
  Medium: "#FF9800",
  High: "#F44336",
  Critical: "#9C27B0",
};

const STATUS_COLORS = {
  Queued: "#607D8B",
  "In Progress": "#2196F3",
  "Pending Review": "#FF9800",
  Approved: "#4CAF50",
  Closed: "#9E9E9E",
};

const STATUSES = [
  "Queued",
  "In Progress",
  "Pending Review",
  "Approved",
  "Closed",
];

const PRIORITIES = ["Low", "Medium", "High", "Critical"];

const RESOLVED_STATUSES = ["Approved", "Closed"];

const STORAGE_KEYS = {
  users: "app:users",
  tasks: "app:tasks",
  notifications: "app:notifications",
  currentUserId: "app:currentUserId",
};

/* =====================================================================
   HELPERS
   ===================================================================== */

const uid = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
};

const nowISO = () => new Date().toISOString();

const hoursFromNow = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();
const daysFromNow = (d) => hoursFromNow(d * 24);

const initials = (name) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function formatRelative(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return sec <= 1 ? "just now" : `${sec} sec ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day > 1 ? "s" : ""} ago`;
  const mo = Math.round(day / 30);
  return `${mo} mo ago`;
}

function formatDuration(ms) {
  if (ms < 0) ms = 0;
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hrs = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days >= 1) return `${days}d ${hrs}h`;
  if (hrs >= 1) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ---- derived task helpers ---- */

function depResolved(task, byId) {
  return (task.dependsOnTaskIds || []).every((id) => {
    const dep = byId[id];
    return dep && RESOLVED_STATUSES.includes(dep.status);
  });
}

function isBlocked(task, byId) {
  if (RESOLVED_STATUSES.includes(task.status) || task.status === "In Progress" || task.status === "Pending Review")
    return false;
  return !depResolved(task, byId);
}

function blockingTitles(task, byId) {
  return (task.dependsOnTaskIds || [])
    .map((id) => byId[id])
    .filter((d) => d && !RESOLVED_STATUSES.includes(d.status))
    .map((d) => d.title);
}

function isOverdue(task) {
  if (RESOLVED_STATUSES.includes(task.status)) return false;
  if (!task.dueDate) return false;
  return new Date(task.dueDate).getTime() < Date.now();
}

function isDueSoon(task) {
  if (RESOLVED_STATUSES.includes(task.status)) return false;
  if (!task.dueDate) return false;
  const t = new Date(task.dueDate).getTime();
  const diff = t - Date.now();
  return diff > 0 && diff <= 24 * 3600 * 1000;
}

function tatMs(task) {
  const start = new Date(task.createdAt).getTime();
  const end = task.approvedAt
    ? new Date(task.approvedAt).getTime()
    : Date.now();
  return end - start;
}

function tatColor(task) {
  if (isOverdue(task)) return "#F44336";
  if (isDueSoon(task)) return "#FF9800";
  return "#4CAF50";
}

/* =====================================================================
   SEED DATA
   ===================================================================== */

function buildSeed() {
  const palette = ["#6C8EF5", "#F2789F", "#43BFA0", "#F5A65B", "#9B72F2"];
  const userDefs = [
    ["Alex Morgan", "Assigner"],
    ["Jordan Lee", "Assignee"],
    ["Sam Rivera", "Assignee"],
    ["Taylor Kim", "Assignee"],
    ["Casey Park", "Assigner"],
  ];
  const users = userDefs.map(([name, role], i) => ({
    id: "u" + (i + 1),
    name,
    role,
    avatar: initials(name),
    color: palette[i],
  }));
  const [alex, jordan, sam, taylor, casey] = users.map((u) => u.id);

  const mk = (over) => ({
    id: uid(),
    title: "",
    description: "",
    priority: "Medium",
    status: "Queued",
    assignerId: alex,
    assigneeId: jordan,
    tags: [],
    estimatedEffort: 4,
    effortUnit: "hours",
    dueDate: daysFromNow(3),
    createdAt: nowISO(),
    startedAt: null,
    completedAt: null,
    approvedAt: null,
    parentTaskId: null,
    linkedTaskIds: [],
    dependsOnTaskIds: [],
    subTasks: [],
    progressUpdates: [],
    approvalHistory: [],
    ...over,
  });

  const t1 = mk({
    title: "Design new onboarding flow",
    description:
      "Create wireframes and a clickable prototype for the revamped first-run experience.",
    priority: "High",
    status: "In Progress",
    assignerId: alex,
    assigneeId: jordan,
    tags: ["design", "ux"],
    estimatedEffort: 12,
    dueDate: daysFromNow(3),
    createdAt: daysFromNow(-5),
    startedAt: daysFromNow(-3),
    progressUpdates: [
      {
        id: uid(),
        taskId: "",
        userId: jordan,
        timestamp: daysFromNow(-2),
        currentWork: "Finished low-fidelity wireframes for all 4 screens.",
        nextSteps: "Move to high-fidelity mockups and wire up the prototype.",
      },
    ],
  });
  t1.progressUpdates[0].taskId = t1.id;

  const t2 = mk({
    title: "API integration for payments",
    description: "Integrate Stripe payment intents and webhooks.",
    priority: "Critical",
    status: "Queued",
    assignerId: alex,
    assigneeId: sam,
    tags: ["backend", "payments"],
    estimatedEffort: 8,
    effortUnit: "points",
    dueDate: daysFromNow(6),
    createdAt: daysFromNow(-4),
    dependsOnTaskIds: [t1.id],
  });

  const t3 = mk({
    title: "Write unit tests for auth module",
    description: "Cover login, refresh-token, and logout flows.",
    priority: "Medium",
    status: "Pending Review",
    assignerId: casey,
    assigneeId: taylor,
    tags: ["testing", "auth"],
    estimatedEffort: 6,
    dueDate: daysFromNow(1),
    createdAt: daysFromNow(-6),
    startedAt: daysFromNow(-5),
    completedAt: daysFromNow(-1),
    progressUpdates: [
      {
        id: uid(),
        taskId: "",
        userId: taylor,
        timestamp: daysFromNow(-1),
        currentWork: "All happy-path tests written, 92% coverage.",
        nextSteps: "Awaiting review; will add edge cases if requested.",
      },
    ],
  });
  t3.progressUpdates[0].taskId = t3.id;

  const t4 = mk({
    title: "Update privacy policy page",
    description: "Reflect new data-retention terms from legal.",
    priority: "Low",
    status: "Approved",
    assignerId: alex,
    assigneeId: taylor,
    tags: ["legal", "content"],
    estimatedEffort: 2,
    dueDate: daysFromNow(-1),
    createdAt: daysFromNow(-8),
    startedAt: daysFromNow(-7),
    completedAt: daysFromNow(-6),
    approvedAt: daysFromNow(-5),
    approvalHistory: [
      {
        id: uid(),
        taskId: "",
        userId: alex,
        action: "Approved",
        comment: "Looks good, legal signed off.",
        timestamp: daysFromNow(-5),
      },
    ],
  });
  t4.approvalHistory[0].taskId = t4.id;

  const t5 = mk({
    title: "Set up CI/CD pipeline",
    description: "GitHub Actions for build, test, and deploy to staging.",
    priority: "High",
    status: "In Progress",
    assignerId: casey,
    assigneeId: jordan,
    tags: ["devops", "ci"],
    estimatedEffort: 10,
    dueDate: daysFromNow(2),
    createdAt: daysFromNow(-3),
    startedAt: daysFromNow(-2),
  });

  const t6 = mk({
    title: "Conduct user interviews",
    description: "5 interviews with power users about the new dashboard.",
    priority: "Medium",
    status: "Queued",
    assignerId: alex,
    assigneeId: sam,
    tags: ["research"],
    estimatedEffort: 5,
    effortUnit: "points",
    dueDate: daysFromNow(5),
    createdAt: daysFromNow(-1),
  });

  const t7 = mk({
    title: "Fix checkout bug on mobile",
    description: "Cart total miscalculated on iOS Safari.",
    priority: "Critical",
    status: "Closed",
    assignerId: casey,
    assigneeId: taylor,
    tags: ["bug", "mobile"],
    estimatedEffort: 3,
    dueDate: daysFromNow(-4),
    createdAt: daysFromNow(-10),
    startedAt: daysFromNow(-9),
    completedAt: daysFromNow(-8),
    approvedAt: daysFromNow(-7),
    progressUpdates: [
      {
        id: uid(),
        taskId: "",
        userId: taylor,
        timestamp: daysFromNow(-8),
        currentWork: "Root-caused to a rounding error in the tax helper.",
        nextSteps: "Patched and added a regression test.",
      },
    ],
    approvalHistory: [
      {
        id: uid(),
        taskId: "",
        userId: casey,
        action: "Approved",
        comment: "Verified on device. Great fix.",
        timestamp: daysFromNow(-7),
      },
    ],
    subTasks: [
      {
        id: uid(),
        title: "Add regression test",
        assigneeId: taylor,
        status: "Done",
        dueDate: daysFromNow(-8),
        createdAt: daysFromNow(-9),
      },
    ],
  });
  t7.progressUpdates[0].taskId = t7.id;
  t7.approvalHistory[0].taskId = t7.id;

  const t8 = mk({
    title: "Q3 performance review docs",
    description: "Compile review templates and calibration notes.",
    priority: "Low",
    status: "Queued",
    assignerId: casey,
    assigneeId: taylor,
    tags: ["hr", "docs"],
    estimatedEffort: 4,
    dueDate: daysFromNow(7),
    createdAt: daysFromNow(-1),
    dependsOnTaskIds: [t7.id], // already resolved (Closed) -> unblocked
  });

  const tasks = [t1, t2, t3, t4, t5, t6, t7, t8];

  const notifications = [
    {
      id: uid(),
      type: "task_created",
      taskId: t1.id,
      taskTitle: t1.title,
      actorId: alex,
      targetUserIds: [jordan],
      message: `Alex Morgan assigned you "${t1.title}"`,
      timestamp: daysFromNow(-5),
      read: false,
    },
    {
      id: uid(),
      type: "update_posted",
      taskId: t1.id,
      taskTitle: t1.title,
      actorId: jordan,
      targetUserIds: [alex],
      message: `Jordan Lee posted an update on "${t1.title}"`,
      timestamp: daysFromNow(-2),
      read: false,
    },
    {
      id: uid(),
      type: "marked_complete",
      taskId: t3.id,
      taskTitle: t3.title,
      actorId: taylor,
      targetUserIds: [casey],
      message: `Taylor Kim moved "${t3.title}" to Pending Review`,
      timestamp: daysFromNow(-1),
      read: false,
    },
    {
      id: uid(),
      type: "approved",
      taskId: t4.id,
      taskTitle: t4.title,
      actorId: alex,
      targetUserIds: [taylor],
      message: `Alex Morgan approved "${t4.title}"`,
      timestamp: daysFromNow(-5),
      read: true,
    },
  ];

  return { users, tasks, notifications, currentUserId: alex };
}

/* =====================================================================
   STORAGE
   ===================================================================== */

const storage = {
  async get(key) {
    try {
      if (typeof window !== "undefined" && window.storage)
        return await window.storage.get(key);
    } catch (e) {
      console.warn("storage.get failed", e);
    }
    return null;
  },
  async set(key, value) {
    try {
      if (typeof window !== "undefined" && window.storage)
        return await window.storage.set(key, value);
    } catch (e) {
      console.warn("storage.set failed", e);
    }
    return null;
  },
  async list(prefix) {
    try {
      if (typeof window !== "undefined" && window.storage)
        return await window.storage.list(prefix);
    } catch (e) {
      console.warn("storage.list failed", e);
    }
    return null;
  },
};

function parse(raw, fallback) {
  if (raw == null) return fallback;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return fallback;
  }
}

/* =====================================================================
   REDUCER
   ===================================================================== */

const initialState = {
  hydrated: false,
  users: [],
  tasks: [],
  notifications: [],
  currentUserId: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, ...action.payload, hydrated: true };
    case "PATCH":
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

/* =====================================================================
   APP CONTEXT
   ===================================================================== */

const AppContext = createContext(null);
const useApp = () => useContext(AppContext);

function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // ---- hydrate ----
  useEffect(() => {
    let alive = true;
    (async () => {
      const [u, t, n, cu] = await Promise.all([
        storage.get(STORAGE_KEYS.users),
        storage.get(STORAGE_KEYS.tasks),
        storage.get(STORAGE_KEYS.notifications),
        storage.get(STORAGE_KEYS.currentUserId),
      ]);
      if (!alive) return;
      const users = parse(u && u.value, null);
      if (users && users.length) {
        dispatch({
          type: "HYDRATE",
          payload: {
            users,
            tasks: parse(t && t.value, []),
            notifications: parse(n && n.value, []),
            currentUserId:
              parse(cu && cu.value, null) || users[0].id,
          },
        });
      } else {
        const seed = buildSeed();
        dispatch({ type: "HYDRATE", payload: seed });
        await Promise.all([
          storage.set(STORAGE_KEYS.users, JSON.stringify(seed.users)),
          storage.set(STORAGE_KEYS.tasks, JSON.stringify(seed.tasks)),
          storage.set(
            STORAGE_KEYS.notifications,
            JSON.stringify(seed.notifications)
          ),
          storage.set(
            STORAGE_KEYS.currentUserId,
            JSON.stringify(seed.currentUserId)
          ),
        ]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ---- persistence (after hydration) ----
  useEffect(() => {
    if (!state.hydrated) return;
    storage.set(STORAGE_KEYS.tasks, JSON.stringify(state.tasks));
  }, [state.tasks, state.hydrated]);

  useEffect(() => {
    if (!state.hydrated) return;
    storage.set(
      STORAGE_KEYS.notifications,
      JSON.stringify(state.notifications)
    );
  }, [state.notifications, state.hydrated]);

  useEffect(() => {
    if (!state.hydrated) return;
    storage.set(STORAGE_KEYS.users, JSON.stringify(state.users));
  }, [state.users, state.hydrated]);

  useEffect(() => {
    if (!state.hydrated || !state.currentUserId) return;
    storage.set(
      STORAGE_KEYS.currentUserId,
      JSON.stringify(state.currentUserId)
    );
  }, [state.currentUserId, state.hydrated]);

  // ---- derived ----
  const byId = useMemo(() => {
    const m = {};
    state.tasks.forEach((t) => (m[t.id] = t));
    return m;
  }, [state.tasks]);

  const usersById = useMemo(() => {
    const m = {};
    state.users.forEach((u) => (m[u.id] = u));
    return m;
  }, [state.users]);

  const currentUser = usersById[state.currentUserId] || null;

  // ---- action helpers ----
  const patch = useCallback((payload) => dispatch({ type: "PATCH", payload }), []);

  const setCurrentUser = useCallback(
    (id) => patch({ currentUserId: id }),
    [patch]
  );

  // create task
  const createTask = useCallback(
    (data) => {
      const t = {
        id: uid(),
        title: data.title.trim(),
        description: data.description || "",
        priority: data.priority || "Medium",
        status: "Queued",
        assignerId: state.currentUserId,
        assigneeId: data.assigneeId,
        tags: data.tags || [],
        estimatedEffort: Number(data.estimatedEffort) || 0,
        effortUnit: data.effortUnit || "hours",
        dueDate: data.dueDate || daysFromNow(7),
        createdAt: nowISO(),
        startedAt: null,
        completedAt: null,
        approvedAt: null,
        parentTaskId: data.parentTaskId || null,
        linkedTaskIds: [],
        dependsOnTaskIds: data.dependsOnTaskIds || [],
        subTasks: [],
        progressUpdates: [],
        approvalHistory: [],
      };
      const newTasks = state.tasks.map((x) =>
        x.id === t.parentTaskId
          ? { ...x, linkedTaskIds: [...x.linkedTaskIds, t.id] }
          : x
      );
      newTasks.push(t);
      const notif = {
        id: uid(),
        type: "task_created",
        taskId: t.id,
        taskTitle: t.title,
        actorId: state.currentUserId,
        targetUserIds: [t.assigneeId],
        message: `${nameOf(usersById, state.currentUserId)} assigned you "${t.title}"`,
        timestamp: nowISO(),
        read: false,
      };
      patch({
        tasks: newTasks,
        notifications: [notif, ...state.notifications],
      });
      return t;
    },
    [state.tasks, state.notifications, state.currentUserId, usersById, patch]
  );

  // generic transition with cascade
  const transitionStatus = useCallback(
    (taskId, newStatus) => {
      const task = byId[taskId];
      if (!task) return;
      const ts = nowISO();
      const updated = { ...task, status: newStatus };
      if (newStatus === "In Progress" && !updated.startedAt)
        updated.startedAt = ts;
      if (newStatus === "Pending Review") updated.completedAt = ts;
      if (newStatus === "Approved") {
        updated.approvedAt = ts;
        if (!updated.completedAt) updated.completedAt = ts;
      }

      let tasks = state.tasks.map((t) => (t.id === taskId ? updated : t));
      const notifs = [];

      const actorName = nameOf(usersById, state.currentUserId);

      if (newStatus === "Pending Review") {
        notifs.push(
          mkNotif("marked_complete", updated, state.currentUserId, [
            updated.assignerId,
          ], `${actorName} submitted "${updated.title}" for review`)
        );
      } else if (newStatus === "In Progress" && task.status === "Pending Review") {
        notifs.push(
          mkNotif("changes_requested", updated, state.currentUserId, [
            updated.assigneeId,
          ], `${actorName} requested changes on "${updated.title}"`)
        );
      } else if (newStatus === "Closed") {
        notifs.push(
          mkNotif("task_closed", updated, state.currentUserId, [
            updated.assigneeId,
          ], `${actorName} closed "${updated.title}"`)
        );
      }

      // cascade unblock when this task becomes resolved
      if (RESOLVED_STATUSES.includes(newStatus)) {
        const map = {};
        tasks.forEach((t) => (map[t.id] = t));
        tasks.forEach((t) => {
          if (
            (t.dependsOnTaskIds || []).includes(taskId) &&
            !RESOLVED_STATUSES.includes(t.status)
          ) {
            const wasBlocked = (t.dependsOnTaskIds || []).some((id) => {
              const dep = id === taskId ? task : map[id];
              return dep && !RESOLVED_STATUSES.includes(dep.status);
            });
            // recompute blocked AFTER
            const nowResolved = depResolved(t, map);
            if (wasBlocked && nowResolved) {
              notifs.push(
                mkNotif("dependency_unblocked", t, state.currentUserId, [
                  t.assigneeId,
                ], `"${t.title}" is now unblocked and ready to start`)
              );
            }
          }
        });
      }

      patch({
        tasks,
        notifications: [...notifs, ...state.notifications],
      });
    },
    [byId, state.tasks, state.notifications, state.currentUserId, usersById, patch]
  );

  const approveTask = useCallback(
    (taskId, comment) => {
      const task = byId[taskId];
      if (!task) return;
      const ts = nowISO();
      const event = {
        id: uid(),
        taskId,
        userId: state.currentUserId,
        action: "Approved",
        comment: comment || "",
        timestamp: ts,
      };
      const updated = {
        ...task,
        status: "Approved",
        approvedAt: ts,
        completedAt: task.completedAt || ts,
        approvalHistory: [...task.approvalHistory, event],
      };
      let tasks = state.tasks.map((t) => (t.id === taskId ? updated : t));
      const notifs = [
        mkNotif("approved", updated, state.currentUserId, [updated.assigneeId],
          `${nameOf(usersById, state.currentUserId)} approved "${updated.title}"`),
      ];
      // cascade
      const map = {};
      tasks.forEach((t) => (map[t.id] = t));
      tasks.forEach((t) => {
        if (
          (t.dependsOnTaskIds || []).includes(taskId) &&
          !RESOLVED_STATUSES.includes(t.status)
        ) {
          if (depResolved(t, map)) {
            notifs.push(
              mkNotif("dependency_unblocked", t, state.currentUserId, [
                t.assigneeId,
              ], `"${t.title}" is now unblocked and ready to start`)
            );
          }
        }
      });
      patch({ tasks, notifications: [...notifs, ...state.notifications] });
    },
    [byId, state.tasks, state.notifications, state.currentUserId, usersById, patch]
  );

  const requestChanges = useCallback(
    (taskId, comment) => {
      const task = byId[taskId];
      if (!task) return;
      const ts = nowISO();
      const event = {
        id: uid(),
        taskId,
        userId: state.currentUserId,
        action: "Changes Requested",
        comment: comment || "",
        timestamp: ts,
      };
      const updated = {
        ...task,
        status: "In Progress",
        approvalHistory: [...task.approvalHistory, event],
      };
      const tasks = state.tasks.map((t) => (t.id === taskId ? updated : t));
      const notif = mkNotif(
        "changes_requested",
        updated,
        state.currentUserId,
        [updated.assigneeId],
        `${nameOf(usersById, state.currentUserId)} requested changes on "${updated.title}"`
      );
      patch({ tasks, notifications: [notif, ...state.notifications] });
    },
    [byId, state.tasks, state.notifications, state.currentUserId, usersById, patch]
  );

  const addProgressUpdate = useCallback(
    (taskId, currentWork, nextSteps) => {
      const task = byId[taskId];
      if (!task) return;
      const update = {
        id: uid(),
        taskId,
        userId: state.currentUserId,
        timestamp: nowISO(),
        currentWork,
        nextSteps,
      };
      const updated = {
        ...task,
        progressUpdates: [...task.progressUpdates, update],
      };
      const tasks = state.tasks.map((t) => (t.id === taskId ? updated : t));
      const notif = mkNotif(
        "update_posted",
        updated,
        state.currentUserId,
        [updated.assignerId],
        `${nameOf(usersById, state.currentUserId)} posted an update on "${updated.title}"`
      );
      patch({ tasks, notifications: [notif, ...state.notifications] });
    },
    [byId, state.tasks, state.notifications, state.currentUserId, usersById, patch]
  );

  const addSubTask = useCallback(
    (taskId, sub) => {
      const task = byId[taskId];
      if (!task) return;
      const subTask = {
        id: uid(),
        title: sub.title,
        assigneeId: sub.assigneeId,
        status: "Queued",
        dueDate: sub.dueDate || daysFromNow(3),
        createdAt: nowISO(),
      };
      const updated = { ...task, subTasks: [...task.subTasks, subTask] };
      const tasks = state.tasks.map((t) => (t.id === taskId ? updated : t));
      patch({ tasks });
    },
    [byId, state.tasks, patch]
  );

  const updateSubTask = useCallback(
    (taskId, subId, newStatus) => {
      const task = byId[taskId];
      if (!task) return;
      const subTasks = task.subTasks.map((s) =>
        s.id === subId ? { ...s, status: newStatus } : s
      );
      const updated = { ...task, subTasks };
      const tasks = state.tasks.map((t) => (t.id === taskId ? updated : t));
      const notifs =
        newStatus === "Done"
          ? [
              mkNotif("subtask_done", updated, state.currentUserId, [
                updated.assignerId,
              ], `${nameOf(usersById, state.currentUserId)} finished a sub-task on "${updated.title}"`),
            ]
          : [];
      patch({ tasks, notifications: [...notifs, ...state.notifications] });
    },
    [byId, state.tasks, state.notifications, state.currentUserId, usersById, patch]
  );

  const markNotifRead = useCallback(
    (id) => {
      patch({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
      });
    },
    [state.notifications, patch]
  );

  const clearNotifications = useCallback(() => {
    patch({ notifications: [] });
  }, [patch]);

  const value = {
    state,
    byId,
    usersById,
    currentUser,
    setCurrentUser,
    createTask,
    transitionStatus,
    approveTask,
    requestChanges,
    addProgressUpdate,
    addSubTask,
    updateSubTask,
    markNotifRead,
    clearNotifications,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function nameOf(usersById, id) {
  return usersById[id] ? usersById[id].name : "Someone";
}

function mkNotif(type, task, actorId, targetUserIds, message) {
  return {
    id: uid(),
    type,
    taskId: task.id,
    taskTitle: task.title,
    actorId,
    targetUserIds,
    message,
    timestamp: nowISO(),
    read: false,
  };
}

/* =====================================================================
   SMALL UI PRIMITIVES
   ===================================================================== */

function Avatar({ user, size = 32, ring = false }) {
  if (!user) return null;
  return (
    <div
      title={`${user.name} · ${user.role}`}
      style={{
        width: size,
        height: size,
        background: user.color,
        fontSize: size * 0.4,
        boxShadow: ring ? `0 0 0 2px ${COLORS.bg}, 0 0 0 3px ${user.color}` : "none",
      }}
      className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 select-none"
    >
      {user.avatar}
    </div>
  );
}

function Badge({ label, color, subtle = false }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap"
      style={{
        color: subtle ? color : "#fff",
        background: subtle ? color + "22" : color,
        border: subtle ? `1px solid ${color}55` : "none",
      }}
    >
      {label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  return <Badge label={priority} color={PRIORITY_COLORS[priority]} subtle />;
}

function StatusBadge({ status }) {
  return <Badge label={status} color={STATUS_COLORS[status]} />;
}

function IconBtn({ children, onClick, active, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-md transition-colors"
      style={{
        background: active ? COLORS.primary + "33" : "transparent",
        color: active ? COLORS.primary : COLORS.muted,
      }}
    >
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-semibold mb-1" style={{ color: COLORS.muted }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-md text-sm outline-none transition-colors";
const inputStyle = {
  background: COLORS.bg,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
};

/* =====================================================================
   SIDEBAR
   ===================================================================== */

function UserSwitcher() {
  const { state, usersById, currentUser, setCurrentUser } = useApp();
  const [open, setOpen] = useState(false);
  if (!currentUser) return null;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 p-2 rounded-lg transition-colors hover:brightness-110"
        style={{ background: COLORS.elevated }}
      >
        <Avatar user={currentUser} size={38} />
        <div className="text-left flex-1 min-w-0">
          <div className="font-bold text-sm truncate" style={{ color: COLORS.text }}>
            {currentUser.name}
          </div>
          <Badge
            label={currentUser.role}
            color={currentUser.role === "Assigner" ? COLORS.primary : "#43BFA0"}
            subtle
          />
        </div>
        <ChevronDown size={16} style={{ color: COLORS.muted }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            className="absolute z-30 left-0 right-0 mt-1 rounded-lg overflow-hidden shadow-2xl"
            style={{ background: COLORS.elevated, border: `1px solid ${COLORS.border}` }}
          >
            {state.users.map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  setCurrentUser(u.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 p-2.5 transition-colors hover:brightness-125"
                style={{
                  background:
                    u.id === currentUser.id ? COLORS.primary + "22" : "transparent",
                }}
              >
                <Avatar user={u} size={30} />
                <div className="text-left flex-1 min-w-0">
                  <div className="text-sm truncate" style={{ color: COLORS.text }}>
                    {u.name}
                  </div>
                  <div className="text-[11px]" style={{ color: COLORS.muted }}>
                    {u.role}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NavLinks({ view, setView }) {
  const { state, currentUser } = useApp();
  const unread = useMemo(
    () =>
      state.notifications.filter(
        (n) => n.targetUserIds.includes(state.currentUserId) && !n.read
      ).length,
    [state.notifications, state.currentUserId]
  );
  const isAssigner = currentUser && currentUser.role === "Assigner";

  const links = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "mytasks", label: "My Tasks", icon: ListChecks },
    ...(isAssigner ? [{ id: "alltasks", label: "All Tasks", icon: CheckSquare }] : []),
    { id: "queue", label: "Queue View", icon: GitBranch },
    { id: "feed", label: "Activity Feed", icon: Bell, badge: unread },
  ];

  return (
    <nav className="mt-4 space-y-1">
      {links.map((l) => {
        const Icon = l.icon;
        const active = view === l.id;
        return (
          <button
            key={l.id}
            onClick={() => setView(l.id)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: active ? COLORS.primary + "22" : "transparent",
              color: active ? COLORS.primary : COLORS.muted,
            }}
          >
            <Icon size={18} />
            <span className="flex-1 text-left">{l.label}</span>
            {l.badge > 0 && (
              <span
                className="notif-pulse text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center text-white"
                style={{ background: "#F44336" }}
              >
                {l.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function Sidebar({ view, setView, onNewTask }) {
  const { currentUser } = useApp();
  const isAssigner = currentUser && currentUser.role === "Assigner";
  return (
    <aside
      className="w-[240px] flex-shrink-0 flex flex-col p-4 h-screen sticky top-0"
      style={{ background: COLORS.surface, borderRight: `1px solid ${COLORS.border}` }}
    >
      <div className="flex items-center gap-2 mb-5 px-1">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: COLORS.primary }}
        >
          <ListChecks size={18} className="text-white" />
        </div>
        <span className="font-bold tracking-wide" style={{ color: COLORS.text }}>
          TaskFlow
        </span>
      </div>
      <UserSwitcher />
      <NavLinks view={view} setView={setView} />
      <div className="flex-1" />
      {isAssigner && (
        <button
          onClick={onNewTask}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm text-white transition-transform hover:-translate-y-0.5"
          style={{ background: COLORS.primary }}
        >
          <Plus size={18} /> New Task
        </button>
      )}
    </aside>
  );
}

/* =====================================================================
   TASK CARD
   ===================================================================== */

function TaskCard({ task, onClick }) {
  const { byId, usersById } = useApp();
  const blocked = isBlocked(task, byId);
  const assignee = usersById[task.assigneeId];
  const overdue = isOverdue(task);
  const dueSoon = isDueSoon(task);
  const blockers = blockingTitles(task, byId);

  return (
    <div
      onClick={() => onClick(task)}
      className="task-card relative rounded-lg p-3 cursor-pointer mb-2"
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        opacity: blocked ? 0.6 : 1,
      }}
    >
      {blocked && (
        <div
          className="absolute top-2 right-2 group"
          title={`Waiting on: ${blockers.join(", ")}`}
        >
          <Lock size={14} style={{ color: COLORS.muted }} />
        </div>
      )}
      <div className="flex items-start gap-2 mb-2 pr-4">
        <span
          className="text-sm font-semibold leading-snug"
          style={{ color: COLORS.text }}
        >
          {task.title}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <PriorityBadge priority={task.priority} />
        {task.tags.slice(0, 2).map((t) => (
          <span
            key={t}
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: COLORS.elevated, color: COLORS.muted }}
          >
            #{t}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {assignee && <Avatar user={assignee} size={24} />}
          <span
            className="text-[11px] font-mono px-1.5 py-0.5 rounded"
            style={{
              color: overdue ? "#fff" : tatColor(task),
              background: overdue ? "#F44336" : tatColor(task) + "22",
            }}
          >
            {formatDate(task.dueDate)}
          </span>
        </div>
        <span className="text-[11px]" style={{ color: COLORS.muted }}>
          {task.estimatedEffort}
          {task.effortUnit === "hours" ? "h" : "pt"}
        </span>
      </div>
    </div>
  );
}

/* =====================================================================
   KANBAN + LIST
   ===================================================================== */

function KanbanBoard({ tasks, onSelect }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 h-full">
      {STATUSES.map((status) => {
        const col = tasks.filter((t) => t.status === status);
        return (
          <div
            key={status}
            className="flex-shrink-0 w-[240px] flex flex-col rounded-lg"
            style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}` }}
          >
            <div
              className="flex items-center justify-between px-3 py-2 sticky top-0 rounded-t-lg"
              style={{ background: COLORS.bg, borderBottom: `2px solid ${STATUS_COLORS[status]}` }}
            >
              <span className="text-xs font-bold" style={{ color: COLORS.text }}>
                {status}
              </span>
              <span
                className="text-[11px] font-bold rounded-full px-1.5"
                style={{ background: COLORS.elevated, color: COLORS.muted }}
              >
                {col.length}
              </span>
            </div>
            <div className="p-2 flex-1 overflow-y-auto max-h-[calc(100vh-220px)]">
              {col.map((t) => (
                <TaskCard key={t.id} task={t} onClick={onSelect} />
              ))}
              {col.length === 0 && (
                <div
                  className="text-center text-xs py-6"
                  style={{ color: COLORS.muted }}
                >
                  Empty
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({ tasks, onSelect }) {
  const { byId, usersById } = useApp();
  const [sortKey, setSortKey] = useState("dueDate");
  const [asc, setAsc] = useState(true);

  const sorted = useMemo(() => {
    const arr = [...tasks];
    arr.sort((a, b) => {
      let av, bv;
      switch (sortKey) {
        case "title":
          av = a.title.toLowerCase();
          bv = b.title.toLowerCase();
          break;
        case "priority":
          av = PRIORITIES.indexOf(a.priority);
          bv = PRIORITIES.indexOf(b.priority);
          break;
        case "status":
          av = STATUSES.indexOf(a.status);
          bv = STATUSES.indexOf(b.status);
          break;
        case "assignee":
          av = (usersById[a.assigneeId] || {}).name || "";
          bv = (usersById[b.assigneeId] || {}).name || "";
          break;
        case "tat":
          av = tatMs(a);
          bv = tatMs(b);
          break;
        default:
          av = new Date(a.dueDate || 0).getTime();
          bv = new Date(b.dueDate || 0).getTime();
      }
      if (av < bv) return asc ? -1 : 1;
      if (av > bv) return asc ? 1 : -1;
      return 0;
    });
    return arr;
  }, [tasks, sortKey, asc, usersById]);

  const cols = [
    { key: "title", label: "Title" },
    { key: "priority", label: "Priority" },
    { key: "status", label: "Status" },
    { key: "assignee", label: "Assignee" },
    { key: "dueDate", label: "Due" },
    { key: "tat", label: "TAT" },
    { key: "tags", label: "Tags" },
  ];

  const setSort = (k) => {
    if (k === "tags") return;
    if (sortKey === k) setAsc((a) => !a);
    else {
      setSortKey(k);
      setAsc(true);
    }
  };

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: `1px solid ${COLORS.border}` }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: COLORS.elevated }}>
            {cols.map((c) => (
              <th
                key={c.key}
                onClick={() => setSort(c.key)}
                className="text-left px-3 py-2 text-xs font-bold cursor-pointer select-none"
                style={{ color: COLORS.muted }}
              >
                {c.label}
                {sortKey === c.key ? (asc ? " ▲" : " ▼") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => {
            const overdue = isOverdue(t);
            const assignee = usersById[t.assigneeId];
            const blocked = isBlocked(t, byId);
            return (
              <tr
                key={t.id}
                onClick={() => onSelect(t)}
                className="cursor-pointer transition-colors"
                style={{
                  background: COLORS.surface,
                  borderBottom: `1px solid ${COLORS.border}`,
                  borderLeft: overdue ? "3px solid #F44336" : "3px solid transparent",
                }}
              >
                <td className="px-3 py-2" style={{ color: COLORS.text }}>
                  <div className="flex items-center gap-1.5">
                    {blocked && <Lock size={12} style={{ color: COLORS.muted }} />}
                    {t.title}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <PriorityBadge priority={t.priority} />
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-3 py-2">
                  {assignee && (
                    <div className="flex items-center gap-1.5">
                      <Avatar user={assignee} size={22} />
                      <span style={{ color: COLORS.muted }} className="text-xs">
                        {assignee.name}
                      </span>
                    </div>
                  )}
                </td>
                <td
                  className="px-3 py-2 font-mono text-xs"
                  style={{ color: tatColor(t) }}
                >
                  {formatDate(t.dueDate)}
                </td>
                <td
                  className="px-3 py-2 font-mono text-xs"
                  style={{ color: COLORS.muted }}
                >
                  {formatDuration(tatMs(t))}
                  {!t.approvedAt && "*"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {t.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1 rounded"
                        style={{ background: COLORS.elevated, color: COLORS.muted }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <div className="text-center py-10 text-sm" style={{ color: COLORS.muted, background: COLORS.surface }}>
          No tasks.
        </div>
      )}
    </div>
  );
}

function ViewToggle({ mode, setMode }) {
  return (
    <div
      className="flex rounded-md overflow-hidden"
      style={{ border: `1px solid ${COLORS.border}` }}
    >
      <IconBtn active={mode === "board"} onClick={() => setMode("board")} title="Board">
        <LayoutGrid size={16} />
      </IconBtn>
      <IconBtn active={mode === "list"} onClick={() => setMode("list")} title="List">
        <ListIcon size={16} />
      </IconBtn>
    </div>
  );
}

function TaskAreaHeader({ title, subtitle, mode, setMode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h1 className="text-xl font-bold tracking-wide" style={{ color: COLORS.text }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm" style={{ color: COLORS.muted }}>
            {subtitle}
          </p>
        )}
      </div>
      <ViewToggle mode={mode} setMode={setMode} />
    </div>
  );
}

/* =====================================================================
   METRICS
   ===================================================================== */

function MetricCard({ label, value, sub, accent }) {
  return (
    <div
      className="rounded-lg p-4 flex-1 min-w-[140px]"
      style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
    >
      <div className="text-xs font-semibold mb-1" style={{ color: COLORS.muted }}>
        {label}
      </div>
      <div className="text-2xl font-bold" style={{ color: accent || COLORS.text }}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] mt-0.5" style={{ color: COLORS.muted }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function userMetrics(tasks, user) {
  const isAssigner = user.role === "Assigner";
  const mine = isAssigner
    ? tasks.filter((t) => t.assignerId === user.id)
    : tasks.filter((t) => t.assigneeId === user.id);
  const completed = mine.filter((t) => RESOLVED_STATUSES.includes(t.status));
  const overdue = mine.filter(isOverdue);
  const inProgress = mine.filter((t) => t.status === "In Progress");
  const tats = completed
    .filter((t) => t.approvedAt)
    .map((t) => new Date(t.approvedAt).getTime() - new Date(t.createdAt).getTime());
  const avg = tats.length ? tats.reduce((a, b) => a + b, 0) / tats.length : 0;
  return {
    isAssigner,
    assigned: mine.length,
    completed: completed.length,
    overdue: overdue.length,
    inProgress: inProgress.length,
    avgTAT: avg,
  };
}

function DashboardView({ onSelect }) {
  const { state, currentUser, usersById } = useApp();
  const tasks = state.tasks;
  const m = userMetrics(tasks, currentUser);
  const isAssigner = currentUser.role === "Assigner";

  const statusData = useMemo(
    () =>
      STATUSES.map((s) => ({
        name: s,
        value: tasks.filter((t) => t.status === s).length,
      })).filter((d) => d.value > 0),
    [tasks]
  );

  const workloadData = useMemo(
    () =>
      state.users
        .filter((u) => u.role === "Assignee")
        .map((u) => ({
          name: u.avatar,
          fullName: u.name,
          value: tasks.filter(
            (t) => t.assigneeId === u.id && t.status === "In Progress"
          ).length,
        })),
    [state.users, tasks]
  );

  const overdueTasks = useMemo(() => tasks.filter(isOverdue), [tasks]);

  const teamTats = tasks
    .filter((t) => RESOLVED_STATUSES.includes(t.status) && t.approvedAt)
    .map((t) => new Date(t.approvedAt).getTime() - new Date(t.createdAt).getTime());
  const teamAvg = teamTats.length
    ? teamTats.reduce((a, b) => a + b, 0) / teamTats.length
    : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-wide" style={{ color: COLORS.text }}>
          {isAssigner ? "Team Dashboard" : "My Dashboard"}
        </h1>
        <p className="text-sm" style={{ color: COLORS.muted }}>
          {isAssigner
            ? "Overview of all team activity and metrics"
            : `Your personal metrics, ${currentUser.name}`}
        </p>
      </div>

      {/* personal metrics */}
      <div className="flex flex-wrap gap-3">
        <MetricCard
          label={m.isAssigner ? "Tasks Created" : "Tasks Assigned"}
          value={m.assigned}
        />
        <MetricCard label="Completed" value={m.completed} accent="#4CAF50" />
        <MetricCard
          label="Avg TAT"
          value={m.avgTAT ? formatDuration(m.avgTAT) : "—"}
        />
        <MetricCard
          label="Overdue"
          value={m.overdue}
          accent={m.overdue ? "#F44336" : COLORS.text}
        />
        <MetricCard label="In Progress" value={m.inProgress} accent="#2196F3" />
      </div>

      {/* charts (assigners get the full team view) */}
      {isAssigner && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div
            className="rounded-lg p-4"
            style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
          >
            <h3 className="text-sm font-bold mb-2" style={{ color: COLORS.text }}>
              Status Distribution
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={2}
                >
                  {statusData.map((d) => (
                    <Cell key={d.name} fill={STATUS_COLORS[d.name]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: COLORS.elevated,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 8,
                    color: COLORS.text,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 justify-center mt-1">
              {statusData.map((d) => (
                <div key={d.name} className="flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: STATUS_COLORS[d.name] }}
                  />
                  <span className="text-[11px]" style={{ color: COLORS.muted }}>
                    {d.name} ({d.value})
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div
            className="rounded-lg p-4"
            style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
          >
            <h3 className="text-sm font-bold mb-2" style={{ color: COLORS.text }}>
              Team Workload (In Progress)
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={workloadData}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: COLORS.muted, fontSize: 12 }}
                  axisLine={{ stroke: COLORS.border }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: COLORS.muted, fontSize: 12 }}
                  axisLine={{ stroke: COLORS.border }}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: COLORS.elevated }}
                  contentStyle={{
                    background: COLORS.elevated,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 8,
                    color: COLORS.text,
                  }}
                  formatter={(v, n, p) => [v, p.payload.fullName]}
                />
                <Bar dataKey="value" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* overdue + team tat */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          className="rounded-lg p-4"
          style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} style={{ color: "#F44336" }} />
            <h3 className="text-sm font-bold" style={{ color: COLORS.text }}>
              Overdue Tasks ({overdueTasks.length})
            </h3>
          </div>
          <div className="space-y-1.5">
            {overdueTasks.length === 0 && (
              <p className="text-xs" style={{ color: COLORS.muted }}>
                Nothing overdue. 🎉
              </p>
            )}
            {overdueTasks.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelect(t)}
                className="w-full text-left flex items-center justify-between px-2 py-1.5 rounded hover:brightness-125 transition"
                style={{ background: COLORS.bg }}
              >
                <span className="text-xs" style={{ color: COLORS.text }}>
                  {t.title}
                </span>
                <span className="text-[10px] font-mono" style={{ color: "#F44336" }}>
                  due {formatDate(t.dueDate)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div
          className="rounded-lg p-4 flex flex-col justify-center"
          style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} style={{ color: COLORS.primary }} />
            <h3 className="text-sm font-bold" style={{ color: COLORS.text }}>
              Team Average TAT
            </h3>
          </div>
          <div className="text-3xl font-bold" style={{ color: COLORS.primary }}>
            {teamAvg ? formatDuration(teamAvg) : "—"}
          </div>
          <p className="text-[11px] mt-1" style={{ color: COLORS.muted }}>
            across {teamTats.length} approved/closed task
            {teamTats.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   QUEUE / DEPENDENCY VIEW
   ===================================================================== */

function QueueView({ onSelect }) {
  const { state, byId, usersById } = useApp();
  // build chains: roots are tasks that something depends on, or that have deps
  const involved = state.tasks.filter(
    (t) =>
      (t.dependsOnTaskIds && t.dependsOnTaskIds.length) ||
      state.tasks.some((o) => (o.dependsOnTaskIds || []).includes(t.id))
  );

  // group into chains via union of dependency relations
  const chains = useMemo(() => {
    const adj = {};
    involved.forEach((t) => (adj[t.id] = new Set()));
    involved.forEach((t) => {
      (t.dependsOnTaskIds || []).forEach((d) => {
        if (adj[d]) {
          adj[t.id].add(d);
          adj[d].add(t.id);
        }
      });
    });
    const seen = new Set();
    const groups = [];
    involved.forEach((t) => {
      if (seen.has(t.id)) return;
      const stack = [t.id];
      const grp = [];
      while (stack.length) {
        const id = stack.pop();
        if (seen.has(id)) continue;
        seen.add(id);
        grp.push(id);
        adj[id].forEach((n) => !seen.has(n) && stack.push(n));
      }
      // order within group: dependencies first (topological-ish by dep count)
      grp.sort(
        (a, b) =>
          (byId[a].dependsOnTaskIds || []).length -
          (byId[b].dependsOnTaskIds || []).length
      );
      groups.push(grp.map((id) => byId[id]));
    });
    return groups;
  }, [involved, byId]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-wide" style={{ color: COLORS.text }}>
          Queue & Dependency Chains
        </h1>
        <p className="text-sm" style={{ color: COLORS.muted }}>
          Tasks connected by dependencies. Dimmed nodes are blocked.
        </p>
      </div>

      {chains.length === 0 && (
        <div
          className="rounded-lg p-8 text-center text-sm"
          style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.muted }}
        >
          No dependency chains yet.
        </div>
      )}

      {chains.map((chain, i) => (
        <div
          key={i}
          className="rounded-lg p-4 overflow-x-auto"
          style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
        >
          <div className="flex items-center gap-1 min-w-min">
            {chain.map((t, idx) => {
              const blocked = isBlocked(t, byId);
              const assignee = usersById[t.assigneeId];
              return (
                <React.Fragment key={t.id}>
                  <div
                    onClick={() => onSelect(t)}
                    className="task-card flex-shrink-0 w-[180px] rounded-lg p-3 cursor-pointer"
                    style={{
                      background: COLORS.bg,
                      border: `1px solid ${blocked ? COLORS.border : STATUS_COLORS[t.status]}`,
                      opacity: blocked ? 0.55 : 1,
                    }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <StatusBadge status={t.status} />
                      {blocked && <Lock size={12} style={{ color: COLORS.muted }} />}
                    </div>
                    <div
                      className="text-sm font-semibold mb-2 leading-snug"
                      style={{ color: COLORS.text }}
                    >
                      {t.title}
                    </div>
                    <div className="flex items-center justify-between">
                      {assignee && <Avatar user={assignee} size={22} />}
                      <span
                        className="text-[10px] font-mono"
                        style={{ color: tatColor(t) }}
                      >
                        {formatDate(t.dueDate)}
                      </span>
                    </div>
                  </div>
                  {idx < chain.length - 1 && (
                    <ArrowRight
                      size={20}
                      className="flex-shrink-0"
                      style={{ color: COLORS.muted }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* =====================================================================
   ACTIVITY FEED
   ===================================================================== */

const NOTIF_LABEL = {
  task_created: "created a task",
  update_posted: "posted an update",
  marked_complete: "submitted for review",
  approved: "approved a task",
  changes_requested: "requested changes",
  dependency_unblocked: "task unblocked",
  subtask_done: "completed a sub-task",
  task_closed: "closed a task",
};

function ActivityFeedView({ onSelect }) {
  const { state, usersById, markNotifRead, clearNotifications } = useApp();
  const mine = state.notifications.filter((n) =>
    n.targetUserIds.includes(state.currentUserId)
  );

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-wide" style={{ color: COLORS.text }}>
            Activity Feed
          </h1>
          <p className="text-sm" style={{ color: COLORS.muted }}>
            Notifications for {usersById[state.currentUserId]?.name}
          </p>
        </div>
        <button
          onClick={clearNotifications}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md"
          style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.muted }}
        >
          <Trash2 size={14} /> Clear all
        </button>
      </div>

      <div className="space-y-2">
        {mine.length === 0 && (
          <div
            className="rounded-lg p-8 text-center text-sm"
            style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.muted }}
          >
            No notifications.
          </div>
        )}
        {mine.map((n) => {
          const actor = usersById[n.actorId];
          return (
            <div
              key={n.id}
              onClick={() => markNotifRead(n.id)}
              className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition"
              style={{
                background: n.read ? COLORS.surface : COLORS.elevated,
                border: `1px solid ${n.read ? COLORS.border : COLORS.primary + "55"}`,
              }}
            >
              {actor && <Avatar user={actor} size={32} />}
              <div className="flex-1 min-w-0">
                <div className="text-sm" style={{ color: COLORS.text }}>
                  {n.message}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const task = state.tasks.find((t) => t.id === n.taskId);
                    if (task) onSelect(task);
                    markNotifRead(n.id);
                  }}
                  className="text-xs mt-0.5 hover:underline"
                  style={{ color: COLORS.primary }}
                >
                  {n.taskTitle} →
                </button>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] font-mono" style={{ color: COLORS.muted }}>
                  {formatRelative(n.timestamp)}
                </span>
                {!n.read && (
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: COLORS.primary }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =====================================================================
   TASK DETAIL PANEL
   ===================================================================== */

function StatusActions({ task }) {
  const { currentUser, transitionStatus, byId } = useApp();
  const blocked = isBlocked(task, byId);
  const isAssignee = currentUser.id === task.assigneeId;
  const isCreator = currentUser.id === task.assignerId;

  const btn = (label, onClick, color, disabled, title) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="px-3 py-1.5 rounded-md text-xs font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: color }}
    >
      {label}
    </button>
  );

  const actions = [];
  if (isAssignee && task.status === "Queued") {
    actions.push(
      btn(
        "Start Task",
        () => transitionStatus(task.id, "In Progress"),
        "#2196F3",
        blocked,
        blocked ? `Waiting on: ${blockingTitles(task, byId).join(", ")}` : "Move to In Progress"
      )
    );
  }
  if (isAssignee && task.status === "In Progress") {
    actions.push(
      btn(
        "Submit for Review",
        () => transitionStatus(task.id, "Pending Review"),
        "#FF9800"
      )
    );
  }
  if (isCreator && task.status === "Approved") {
    actions.push(
      btn("Close Task", () => transitionStatus(task.id, "Closed"), "#9E9E9E")
    );
  }
  if (actions.length === 0) return null;
  return <div className="flex flex-wrap gap-2">{actions}</div>;
}

function SubTasksSection({ task }) {
  const { currentUser, usersById, state, addSubTask, updateSubTask } = useApp();
  const isCreator = currentUser.id === task.assignerId;
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const assignees = state.users.filter((u) => u.role === "Assignee");

  const subStatusColor = { Queued: "#607D8B", "In Progress": "#2196F3", Done: "#4CAF50" };
  const cycle = { Queued: "In Progress", "In Progress": "Done", Done: "Queued" };

  return (
    <Section title={`Sub-tasks (${task.subTasks.length})`}>
      <div className="space-y-1.5 mb-2">
        {task.subTasks.map((s) => {
          const a = usersById[s.assigneeId];
          const canToggle = currentUser.id === s.assigneeId || isCreator;
          return (
            <div
              key={s.id}
              className="flex items-center gap-2 p-2 rounded"
              style={{ background: COLORS.bg }}
            >
              <button
                disabled={!canToggle}
                onClick={() => updateSubTask(task.id, s.id, cycle[s.status])}
                className="flex-shrink-0 disabled:opacity-50"
                title={canToggle ? "Click to advance status" : ""}
              >
                <Badge label={s.status} color={subStatusColor[s.status]} subtle />
              </button>
              <span
                className="text-xs flex-1"
                style={{
                  color: COLORS.text,
                  textDecoration: s.status === "Done" ? "line-through" : "none",
                  opacity: s.status === "Done" ? 0.6 : 1,
                }}
              >
                {s.title}
              </span>
              {a && <Avatar user={a} size={20} />}
            </div>
          );
        })}
        {task.subTasks.length === 0 && (
          <p className="text-xs" style={{ color: COLORS.muted }}>
            No sub-tasks.
          </p>
        )}
      </div>
      {isCreator && (
        <div className="space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sub-task title"
            className={inputCls}
            style={inputStyle}
          />
          <div className="flex gap-2">
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className={inputCls}
              style={inputStyle}
            >
              <option value="">Assignee…</option>
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                if (!title.trim() || !assigneeId) return;
                addSubTask(task.id, { title: title.trim(), assigneeId });
                setTitle("");
                setAssigneeId("");
              }}
              className="px-3 rounded-md text-xs font-semibold text-white flex-shrink-0"
              style={{ background: COLORS.primary }}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

function ProgressSection({ task }) {
  const { currentUser, usersById, addProgressUpdate } = useApp();
  const isAssignee = currentUser.id === task.assigneeId;
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const updates = [...task.progressUpdates].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  return (
    <Section title={`Progress Updates (${updates.length})`}>
      <div className="space-y-2 mb-2">
        {updates.map((u) => {
          const usr = usersById[u.userId];
          return (
            <div
              key={u.id}
              className="p-2.5 rounded"
              style={{ background: COLORS.bg, borderLeft: `2px solid ${COLORS.primary}` }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  {usr && <Avatar user={usr} size={18} />}
                  <span className="text-[11px] font-semibold" style={{ color: COLORS.text }}>
                    {usr?.name}
                  </span>
                </div>
                <span className="text-[10px] font-mono" style={{ color: COLORS.muted }}>
                  {formatRelative(u.timestamp)}
                </span>
              </div>
              <p className="text-xs" style={{ color: COLORS.text }}>
                <span style={{ color: COLORS.muted }}>Now: </span>
                {u.currentWork}
              </p>
              {u.nextSteps && (
                <p className="text-xs mt-0.5" style={{ color: COLORS.text }}>
                  <span style={{ color: COLORS.muted }}>Next: </span>
                  {u.nextSteps}
                </p>
              )}
            </div>
          );
        })}
        {updates.length === 0 && (
          <p className="text-xs" style={{ color: COLORS.muted }}>
            No updates yet.
          </p>
        )}
      </div>
      {isAssignee && (task.status === "In Progress" || task.status === "Pending Review") && (
        <div className="space-y-2">
          <textarea
            value={cur}
            onChange={(e) => setCur(e.target.value)}
            placeholder="What did you work on?"
            rows={2}
            className={inputCls}
            style={inputStyle}
          />
          <textarea
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="Next steps…"
            rows={2}
            className={inputCls}
            style={inputStyle}
          />
          <button
            onClick={() => {
              if (!cur.trim()) return;
              addProgressUpdate(task.id, cur.trim(), next.trim());
              setCur("");
              setNext("");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white"
            style={{ background: COLORS.primary }}
          >
            <MessageSquarePlus size={14} /> Add Update
          </button>
        </div>
      )}
    </Section>
  );
}

function ApprovalHistorySection({ task }) {
  const { usersById } = useApp();
  if (!task.approvalHistory.length) return null;
  return (
    <Section title="Approval History">
      <div className="space-y-2">
        {task.approvalHistory.map((e) => {
          const usr = usersById[e.userId];
          const approved = e.action === "Approved";
          return (
            <div key={e.id} className="p-2.5 rounded" style={{ background: COLORS.bg }}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  {approved ? (
                    <ThumbsUp size={13} style={{ color: "#4CAF50" }} />
                  ) : (
                    <RotateCcw size={13} style={{ color: "#FF9800" }} />
                  )}
                  <span className="text-[11px] font-semibold" style={{ color: COLORS.text }}>
                    {usr?.name} · {e.action}
                  </span>
                </div>
                <span className="text-[10px] font-mono" style={{ color: COLORS.muted }}>
                  {formatRelative(e.timestamp)}
                </span>
              </div>
              {e.comment && (
                <p className="text-xs" style={{ color: COLORS.muted }}>
                  "{e.comment}"
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-4">
      <h3
        className="text-xs font-bold uppercase tracking-wider mb-2"
        style={{ color: COLORS.muted }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function TaskDetailPanel({ task, onClose, onReview }) {
  const { byId, usersById, currentUser } = useApp();
  const open = !!task;
  const t = task;

  return (
    <div
      className="fixed top-0 right-0 h-screen z-40 flex"
      style={{
        width: 380,
        transform: open ? "translateX(0)" : "translateX(110%)",
        transition: "transform 200ms ease",
      }}
    >
      <div
        className="w-full h-full overflow-y-auto p-5"
        style={{ background: COLORS.surface, borderLeft: `1px solid ${COLORS.border}` }}
      >
        {t && (
          <>
            <div className="flex items-start justify-between mb-3">
              <StatusBadge status={t.status} />
              <button
                onClick={onClose}
                className="p-1 rounded hover:brightness-150"
                style={{ color: COLORS.muted }}
              >
                <X size={18} />
              </button>
            </div>

            <h2 className="text-lg font-bold mb-1" style={{ color: COLORS.text }}>
              {t.title}
            </h2>
            <p className="text-sm mb-3" style={{ color: COLORS.muted }}>
              {t.description || "No description."}
            </p>

            {/* meta grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <MetaItem label="Priority">
                <PriorityBadge priority={t.priority} />
              </MetaItem>
              <MetaItem label="Due">
                <span className="text-sm font-mono" style={{ color: tatColor(t) }}>
                  {formatDate(t.dueDate)}
                </span>
              </MetaItem>
              <MetaItem label="Effort">
                <span className="text-sm" style={{ color: COLORS.text }}>
                  {t.estimatedEffort} {t.effortUnit}
                </span>
              </MetaItem>
              <MetaItem label="TAT">
                <span className="text-sm font-mono" style={{ color: COLORS.text }}>
                  {formatDuration(tatMs(t))}
                  {!t.approvedAt && " (elapsed)"}
                </span>
              </MetaItem>
            </div>

            {/* people */}
            <div className="flex items-center gap-4 mb-4">
              <PersonChip label="Assigner" user={usersById[t.assignerId]} />
              <PersonChip label="Assignee" user={usersById[t.assigneeId]} />
            </div>

            {/* tags */}
            {t.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {t.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] px-2 py-0.5 rounded flex items-center gap-1"
                    style={{ background: COLORS.elevated, color: COLORS.muted }}
                  >
                    <TagIcon size={10} />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* blocked notice */}
            {isBlocked(t, byId) && (
              <div
                className="flex items-center gap-2 p-2.5 rounded-md mb-4"
                style={{ background: "#F4433622", border: "1px solid #F4433655" }}
              >
                <Lock size={14} style={{ color: "#F44336" }} />
                <span className="text-xs" style={{ color: COLORS.text }}>
                  Waiting on: {blockingTitles(t, byId).join(", ")}
                </span>
              </div>
            )}

            {/* status actions */}
            <div className="mb-4 space-y-2">
              <StatusActions task={t} />
              {currentUser.id === t.assignerId && t.status === "Pending Review" && (
                <button
                  onClick={() => onReview(t)}
                  className="w-full px-3 py-2 rounded-md text-sm font-semibold text-white"
                  style={{ background: COLORS.primary }}
                >
                  Review Submission
                </button>
              )}
            </div>

            <div style={{ borderTop: `1px solid ${COLORS.border}` }} className="pt-4">
              <SubTasksSection task={t} />
              <ProgressSection task={t} />
              <ApprovalHistorySection task={t} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MetaItem({ label, children }) {
  return (
    <div className="rounded-md p-2" style={{ background: COLORS.bg }}>
      <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: COLORS.muted }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function PersonChip({ label, user }) {
  return (
    <div className="flex items-center gap-2">
      {user && <Avatar user={user} size={28} />}
      <div>
        <div className="text-[10px] uppercase" style={{ color: COLORS.muted }}>
          {label}
        </div>
        <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
          {user?.name}
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
   APPROVAL MODAL
   ===================================================================== */

function ApprovalModal({ task, onClose, onApprovedFollowUp }) {
  const { usersById, approveTask, requestChanges } = useApp();
  const [stage, setStage] = useState("review"); // review | requestChanges | followUp
  const [comment, setComment] = useState("");
  if (!task) return null;
  const updates = [...task.progressUpdates].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  return (
    <ModalShell onClose={onClose} title="Review Submission" wide>
      {stage === "review" && (
        <>
          <div className="mb-3 p-3 rounded-md" style={{ background: COLORS.bg }}>
            <div className="font-bold text-sm" style={{ color: COLORS.text }}>
              {task.title}
            </div>
            <p className="text-xs mt-1" style={{ color: COLORS.muted }}>
              {task.description}
            </p>
            <div className="flex gap-2 mt-2">
              <PriorityBadge priority={task.priority} />
              <span className="text-xs" style={{ color: COLORS.muted }}>
                Assignee: {usersById[task.assigneeId]?.name}
              </span>
            </div>
          </div>

          <Section title="Progress Log">
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {updates.map((u) => (
                <div key={u.id} className="p-2 rounded text-xs" style={{ background: COLORS.bg }}>
                  <div className="flex justify-between mb-0.5">
                    <span style={{ color: COLORS.text }} className="font-semibold">
                      {usersById[u.userId]?.name}
                    </span>
                    <span className="font-mono" style={{ color: COLORS.muted }}>
                      {formatRelative(u.timestamp)}
                    </span>
                  </div>
                  <div style={{ color: COLORS.text }}>{u.currentWork}</div>
                  {u.nextSteps && (
                    <div style={{ color: COLORS.muted }}>Next: {u.nextSteps}</div>
                  )}
                </div>
              ))}
              {updates.length === 0 && (
                <p className="text-xs" style={{ color: COLORS.muted }}>
                  No progress updates were posted.
                </p>
              )}
            </div>
          </Section>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setStage("requestChanges")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-semibold"
              style={{ background: "#FF980022", color: "#FF9800", border: "1px solid #FF980055" }}
            >
              <RotateCcw size={15} /> Request Changes
            </button>
            <button
              onClick={() => {
                approveTask(task.id, "");
                setStage("followUp");
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-semibold text-white"
              style={{ background: "#4CAF50" }}
            >
              <ThumbsUp size={15} /> Approve
            </button>
          </div>
        </>
      )}

      {stage === "requestChanges" && (
        <>
          <p className="text-sm mb-2" style={{ color: COLORS.text }}>
            Describe the changes needed (required):
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder="What needs to change?"
            className={inputCls}
            style={inputStyle}
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setStage("review")}
              className="px-3 py-2 rounded-md text-sm"
              style={{ background: COLORS.bg, color: COLORS.muted }}
            >
              Back
            </button>
            <button
              disabled={!comment.trim()}
              onClick={() => {
                requestChanges(task.id, comment.trim());
                onClose();
              }}
              className="flex-1 py-2 rounded-md text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: "#FF9800" }}
            >
              Send Back to In Progress
            </button>
          </div>
        </>
      )}

      {stage === "followUp" && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={20} style={{ color: "#4CAF50" }} />
            <span className="font-bold text-sm" style={{ color: COLORS.text }}>
              Approved!
            </span>
          </div>
          <p className="text-sm mb-4" style={{ color: COLORS.muted }}>
            Would you like to create a follow-up task linked to this one, or a new
            independent task?
          </p>
          <div className="space-y-2">
            <button
              onClick={() => onApprovedFollowUp({ parentTaskId: task.id })}
              className="w-full flex items-center gap-2 py-2.5 px-3 rounded-md text-sm font-semibold text-white"
              style={{ background: COLORS.primary }}
            >
              <CornerDownRight size={16} /> Create Follow-up Task
            </button>
            <button
              onClick={() => onApprovedFollowUp({})}
              className="w-full flex items-center gap-2 py-2.5 px-3 rounded-md text-sm font-semibold"
              style={{ background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
            >
              <Plus size={16} /> Create New Task
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 rounded-md text-sm"
              style={{ color: COLORS.muted }}
            >
              Skip
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

/* =====================================================================
   TASK CREATE MODAL
   ===================================================================== */

function TaskCreateModal({ initial, onClose }) {
  const { state, createTask, byId } = useApp();
  const assignees = state.users.filter((u) => u.role === "Assignee");
  const parent = initial.parentTaskId ? byId[initial.parentTaskId] : null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );
  const [assigneeId, setAssigneeId] = useState(parent ? parent.assigneeId : "");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [effort, setEffort] = useState(4);
  const [effortUnit, setEffortUnit] = useState("hours");
  const [dependsOn, setDependsOn] = useState([]);
  const [parentTaskId, setParentTaskId] = useState(initial.parentTaskId || "");
  const [error, setError] = useState("");

  const addTag = () => {
    const v = tagInput.trim().replace(/,/g, "");
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setTagInput("");
  };

  const submit = () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!assigneeId) {
      setError("Please select an assignee");
      return;
    }
    createTask({
      title,
      description,
      priority,
      dueDate: new Date(dueDate).toISOString(),
      assigneeId,
      tags,
      estimatedEffort: effort,
      effortUnit,
      dependsOnTaskIds: dependsOn,
      parentTaskId: parentTaskId || null,
    });
    onClose();
  };

  return (
    <ModalShell onClose={onClose} title="Create Task" wide>
      {parent && (
        <div
          className="mb-3 p-2 rounded-md text-xs flex items-center gap-2"
          style={{ background: COLORS.primary + "22", color: COLORS.primary }}
        >
          <CornerDownRight size={14} /> Follow-up to: {parent.title}
        </div>
      )}

      <Field label="Title *">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputCls}
          style={inputStyle}
          placeholder="Task title"
        />
      </Field>

      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={inputCls}
          style={inputStyle}
          placeholder="Describe the task…"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Priority">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className={inputCls}
            style={inputStyle}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due Date">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputCls}
            style={inputStyle}
          />
        </Field>
      </div>

      <Field label="Assignee *">
        <select
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          className={inputCls}
          style={inputStyle}
        >
          <option value="">Select assignee…</option>
          {assignees.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Tags">
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="text-[11px] px-2 py-0.5 rounded flex items-center gap-1"
              style={{ background: COLORS.elevated, color: COLORS.text }}
            >
              #{t}
              <button onClick={() => setTags(tags.filter((x) => x !== t))}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag();
            }
          }}
          className={inputCls}
          style={inputStyle}
          placeholder="Type a tag and press Enter"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Estimated Effort">
          <input
            type="number"
            min={0}
            value={effort}
            onChange={(e) => setEffort(e.target.value)}
            className={inputCls}
            style={inputStyle}
          />
        </Field>
        <Field label="Unit">
          <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
            {["hours", "points"].map((u) => (
              <button
                key={u}
                onClick={() => setEffortUnit(u)}
                className="flex-1 py-2 text-xs font-semibold capitalize"
                style={{
                  background: effortUnit === u ? COLORS.primary : COLORS.bg,
                  color: effortUnit === u ? "#fff" : COLORS.muted,
                }}
              >
                {u}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <Field label="Depends On (must be Approved first)">
        <div
          className="rounded-md p-2 max-h-28 overflow-y-auto space-y-1"
          style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}` }}
        >
          {state.tasks.length === 0 && (
            <span className="text-xs" style={{ color: COLORS.muted }}>
              No existing tasks
            </span>
          )}
          {state.tasks.map((t) => (
            <label key={t.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dependsOn.includes(t.id)}
                onChange={(e) =>
                  setDependsOn(
                    e.target.checked
                      ? [...dependsOn, t.id]
                      : dependsOn.filter((x) => x !== t.id)
                  )
                }
              />
              <span className="text-xs" style={{ color: COLORS.text }}>
                {t.title}
              </span>
              <StatusBadge status={t.status} />
            </label>
          ))}
        </div>
      </Field>

      <Field label="Parent Task (optional sub-task)">
        <select
          value={parentTaskId}
          onChange={(e) => setParentTaskId(e.target.value)}
          className={inputCls}
          style={inputStyle}
        >
          <option value="">None</option>
          {state.tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </Field>

      {error && (
        <p className="text-xs mb-2" style={{ color: "#F44336" }}>
          {error}
        </p>
      )}

      <div className="flex gap-2 mt-2">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-md text-sm"
          style={{ background: COLORS.bg, color: COLORS.muted }}
        >
          Cancel
        </button>
        <button
          onClick={submit}
          className="flex-1 py-2 rounded-md text-sm font-semibold text-white"
          style={{ background: COLORS.primary }}
        >
          Create Task
        </button>
      </div>
    </ModalShell>
  );
}

/* =====================================================================
   MODAL SHELL
   ===================================================================== */

function ModalShell({ children, onClose, title, wide }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-xl shadow-2xl w-full overflow-y-auto"
        style={{
          background: COLORS.elevated,
          border: `1px solid ${COLORS.border}`,
          maxWidth: wide ? 480 : 380,
          maxHeight: "90vh",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-3 sticky top-0 z-10"
          style={{ background: COLORS.elevated, borderBottom: `1px solid ${COLORS.border}` }}
        >
          <h2 className="font-bold" style={{ color: COLORS.text }}>
            {title}
          </h2>
          <button onClick={onClose} style={{ color: COLORS.muted }}>
            <X size={20} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* =====================================================================
   MAIN CONTENT ROUTER
   ===================================================================== */

function TaskListArea({ tasks, title, subtitle, onSelect }) {
  const [mode, setMode] = useState("board");
  return (
    <div className="h-full flex flex-col">
      <TaskAreaHeader title={title} subtitle={subtitle} mode={mode} setMode={setMode} />
      <div className="flex-1 min-h-0">
        {mode === "board" ? (
          <KanbanBoard tasks={tasks} onSelect={onSelect} />
        ) : (
          <ListView tasks={tasks} onSelect={onSelect} />
        )}
      </div>
    </div>
  );
}

function MainContent({ view, onSelect }) {
  const { state, currentUser } = useApp();

  if (view === "dashboard") return <DashboardView onSelect={onSelect} />;
  if (view === "queue") return <QueueView onSelect={onSelect} />;
  if (view === "feed") return <ActivityFeedView onSelect={onSelect} />;

  if (view === "alltasks") {
    return (
      <TaskListArea
        tasks={state.tasks}
        title="All Tasks"
        subtitle="Every task across the team"
        onSelect={onSelect}
      />
    );
  }

  // mytasks
  const mine = state.tasks.filter(
    (t) =>
      t.assigneeId === currentUser.id || t.assignerId === currentUser.id
  );
  return (
    <TaskListArea
      tasks={mine}
      title="My Tasks"
      subtitle={`Tasks involving ${currentUser.name}`}
      onSelect={onSelect}
    />
  );
}

/* =====================================================================
   ROOT
   ===================================================================== */

function StyleInjector() {
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap');
      * { font-family: 'DM Sans', system-ui, sans-serif; }
      .font-mono, [class*="font-mono"] { font-family: 'JetBrains Mono', monospace !important; }
      h1,h2,h3 { letter-spacing: 0.01em; }
      .task-card { transition: transform 150ms ease, box-shadow 150ms ease; }
      .task-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.4); }
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 4px; }
      @keyframes notifPulse {
        0% { box-shadow: 0 0 0 0 rgba(244,67,54,0.6); }
        70% { box-shadow: 0 0 0 6px rgba(244,67,54,0); }
        100% { box-shadow: 0 0 0 0 rgba(244,67,54,0); }
      }
      .notif-pulse { animation: notifPulse 1.8s infinite; }
      input, select, textarea { font-family: 'DM Sans', sans-serif; }
      input:focus, select:focus, textarea:focus { border-color: ${COLORS.primary} !important; }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  return null;
}

function AppShell() {
  const { state, currentUser } = useApp();
  const [view, setView] = useState("dashboard");
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [createModal, setCreateModal] = useState(null); // null | {parentTaskId?}
  const [approvalTask, setApprovalTask] = useState(null);

  // keep selected task live
  const selectedTask = selectedTaskId
    ? state.tasks.find((t) => t.id === selectedTaskId)
    : null;

  // reset view if assignee lands on alltasks
  useEffect(() => {
    if (view === "alltasks" && currentUser && currentUser.role !== "Assigner") {
      setView("mytasks");
    }
  }, [currentUser, view]);

  if (!state.hydrated || !currentUser) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ background: COLORS.bg, color: COLORS.muted }}
      >
        <div className="text-center">
          <div className="text-lg font-bold mb-1" style={{ color: COLORS.text }}>
            TaskFlow
          </div>
          Loading…
        </div>
      </div>
    );
  }

  const select = (t) => setSelectedTaskId(t.id);

  return (
    <div className="flex min-h-screen" style={{ background: COLORS.bg }}>
      <Sidebar
        view={view}
        setView={setView}
        onNewTask={() => setCreateModal({})}
      />

      <main
        className="flex-1 p-6 overflow-x-hidden transition-all"
        style={{
          marginRight: selectedTask ? 380 : 0,
          transition: "margin 200ms ease",
        }}
      >
        <MainContent view={view} onSelect={select} />
      </main>

      <TaskDetailPanel
        task={selectedTask}
        onClose={() => setSelectedTaskId(null)}
        onReview={(t) => setApprovalTask(t)}
      />

      {createModal && (
        <TaskCreateModal initial={createModal} onClose={() => setCreateModal(null)} />
      )}

      {approvalTask && (
        <ApprovalModal
          task={state.tasks.find((t) => t.id === approvalTask.id)}
          onClose={() => setApprovalTask(null)}
          onApprovedFollowUp={(opts) => {
            setApprovalTask(null);
            setSelectedTaskId(null);
            setCreateModal(opts);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <StyleInjector />
      <AppShell />
    </AppProvider>
  );
}
