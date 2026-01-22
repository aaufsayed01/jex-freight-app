import { PrismaClient, UserRole, CompanyType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { seedPricingTemplates } from "./seed.pricing";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is missing. Make sure backend/.env exists and you run the seed from backend/"
  );
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");
  
  /**
   * 1️⃣ Ensure INTERNAL admin company exists
   * (Company.name is NOT unique, so we cannot use upsert)
   */
  let company = await prisma.company.findFirst({
    where: {
      name: "JEX Admin Company",
      type: CompanyType.INTERNAL,
    },
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: "JEX Admin Company",
        type: CompanyType.INTERNAL,
        country: "UAE",
        city: "Dubai",
        addressLine1: "Business Bay",
        vatNumber: "VAT123456",
        contactEmail: "admin@example.com",
        contactPhone: "+971500000000",
      },
    });
    console.log("🏢 Created admin company");
  } else {
    console.log("🏢 Admin company already exists");
  }

  /**
   * 2️⃣ Ensure ADMIN user exists
   * (User.email IS unique → upsert is correct here)
   */
  const hashedPassword = await bcrypt.hash("Admin123!", 10);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@jex.com" },
    update: {
      passwordHash: hashedPassword,
      fullName: "System Admin",
      role: UserRole.ADMIN,
      companyId: company.id,
      phone: "+971500000001",
      isActive: true,
    },
    create: {
      email: "admin@jex.com",
      passwordHash: hashedPassword,
      fullName: "System Admin",
      role: UserRole.ADMIN,
      companyId: company.id,
      phone: "+971500000001",
      isActive: true,
    },
  });

  await seedPricingTemplates(prisma);

  console.log("👤 Admin user ready");

  console.log("✅ Seed completed successfully");
  console.log("🔐 Admin credentials:");
  console.log("   Email: admin@jex.com");
  console.log("   Password: Admin123!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

