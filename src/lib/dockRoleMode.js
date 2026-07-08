/** Order dock input role — three-way, not two. */
export const DOCK_ROLE = {
  ORDERS: 'orders',
  PATIENT: 'patient',
  TUTOR: 'tutor',
};

export function normalizeDockRole(value) {
  if (value === DOCK_ROLE.PATIENT || value === DOCK_ROLE.TUTOR) return value;
  return DOCK_ROLE.ORDERS;
}

export function isDockOrdersMode(role) {
  return normalizeDockRole(role) === DOCK_ROLE.ORDERS;
}

export function isDockPatientMode(role) {
  return normalizeDockRole(role) === DOCK_ROLE.PATIENT;
}

export function isDockTutorMode(role) {
  return normalizeDockRole(role) === DOCK_ROLE.TUTOR;
}

/** Skip order autocomplete / stack matching when not in orders mode. */
export function dockSkipsOrderMatch(role) {
  return !isDockOrdersMode(role);
}
