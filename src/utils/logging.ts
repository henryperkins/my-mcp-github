// src/utils/logging.ts
export type Level = "debug" | "info" | "notice" | "warning" | "error" | "critical" | "alert" | "emergency";
let level: Level = "info";
const subs: ((e:any)=>void)[] = [];
export function setLogLevel(l: Level){ level = l; }
export function onLog(cb:(e:any)=>void){ subs.push(cb); }
export function log(l: Level, msg: string, extras?: any){
  const order: Level[] = ["debug","info","notice","warning","error","critical","alert","emergency"];
  if (order.indexOf(l) >= order.indexOf(level)) {
    const entry = { ts: Date.now(), level: l, msg, ...(extras || {}) };
    subs.forEach(s => s(entry));
  }
}
