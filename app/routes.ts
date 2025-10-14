import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("stream/*", "routes/stream.tsx"),
  route("stop-transcode", "routes/stop-transcode.tsx"),
] satisfies RouteConfig;
