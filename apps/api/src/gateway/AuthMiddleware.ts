import { GatewayMiddleware, NextFunction } from "./GatewayMiddleware";
import { GatewayRequest } from "./GatewayRequest";
import { GatewayResponse } from "./GatewayResponse";
import { JWT } from "./JWT";

export class AuthMiddleware implements GatewayMiddleware {
  public readonly name = "AuthMiddleware";
  private readonly _jwtSecret = process.env.JWT_SECRET || "shaily-studio-default-jwt-secret-key-12345";

  public async execute(request: GatewayRequest, next: NextFunction): Promise<GatewayResponse> {
    const path = request.path;
    if (
      path === "/health" ||
      path === "/api/health" ||
      path === "/snapshot" ||
      path === "/api/auth/login" ||
      path === "/api/channels/oauth/callback" ||
      path.startsWith("/api/channels/connect/") ||
      path === "/api/internal/run-pipeline"
    ) {
      return next(request);
    }

    const authHeader = request.headers["authorization"] || request.headers["Authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        status: 401,
        headers: { "Content-Type": "application/json" },
        body: { success: false, error: "Unauthorized: Missing or invalid token format" }
      };
    }

    const token = authHeader.substring(7);
    const decoded = JWT.verify(token, this._jwtSecret);
    if (!decoded) {
      return {
        status: 401,
        headers: { "Content-Type": "application/json" },
        body: { success: false, error: "Unauthorized: Invalid or expired token" }
      };
    }

    (request as any).user = decoded;
    return next(request);
  }
}
