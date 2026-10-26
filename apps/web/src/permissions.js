export const canModerate = (role) => ["admin", "spectator"].includes(role);
export const canParticipate = (role) => ["admin", "member"].includes(role);
