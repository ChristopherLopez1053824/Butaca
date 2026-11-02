import { prisma } from "./client.js";

try {
  const result = await prisma.$queryRaw`
    SELECT
      current_database() AS database,
      current_user AS user,
      NOW() AS server_time
  `;

  console.log("Conexión con Supabase exitosa");
  console.log(result);
} catch (error) {
  console.error("Error conectando con Supabase:");
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}