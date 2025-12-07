import { defineConfig, env } from "prisma/config";
import dotenv from "dotenv";

dotenv.config();

// Provide fallback values for CI/CD environments
const getDatabaseUrl = () => {
  try {
    return env("DATABASE_URL");
  } catch {
    // Use a placeholder URL for linting/building without actual DB connection
    return process.env.DATABASE_URL || "postgresql://placeholder:placeholder@localhost:5432/placeholder";
  }
};

const getDirectUrl = () => {
  try {
    return env("DIRECT_URL");
  } catch {
    return process.env.DIRECT_URL || "postgresql://placeholder:placeholder@localhost:5432/placeholder";
  }
};

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: getDatabaseUrl(),
    directUrl: getDirectUrl(),
  },
});
