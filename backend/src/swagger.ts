import swaggerJSDoc from "swagger-jsdoc";
import path from "path";

const rootDir = path.resolve(__dirname); // points to backend/src

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "JEX Freight API",
      version: "1.0.0",
    },
    servers: [{ url: "http://localhost:3001" }],

    tags: [
      { name: "Auth", description: "Authentication" },
      { name: "Users", description: "User profile" },
      { name: "Quotes", description: "Quote requests" },
      { name: "Bookings", description: "Bookings" },
      { name: "Shipments", description: "Shipments & tracking" },
      { name: "Documents", description: "Shipment documents" },
    ],

    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
    security: [{ bearerAuth: [] }],
  },

  apis: [
    path.join(rootDir, "index.ts"),
    path.join(rootDir, "routes", "**", "*.ts"), // ✅ includes subfolders too
  ],
});
