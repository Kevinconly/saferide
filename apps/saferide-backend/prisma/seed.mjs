// Seed script: creates admin, driver and passenger users for local preview.
// Usage: node prisma/seed.mjs  (requires DATABASE_URL in the environment)
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function upsertUser(phone, { role, name, driver }) {
  let user = await prisma.user.findUnique({ where: { phone } })
  if (!user) {
    user = await prisma.user.create({
      data: { phone, name, role, isVerified: true },
    })
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { name, role, isVerified: true, status: 'ACTIVE' },
    })
  }

  if (driver) {
    const existing = await prisma.driver.findUnique({ where: { userId: user.id } })
    if (!existing) {
      await prisma.driver.create({
        data: {
          userId: user.id,
          vehicleMake: driver.vehicleMake,
          vehicleModel: driver.vehicleModel,
          plateNumber: driver.plateNumber,
          isVerified: true,
          status: 'ACTIVE',
        },
      })
    }
  }
  return user
}

async function main() {
  const admin = await upsertUser('+250780000001', { role: 'ADMIN', name: 'Admin User' })
  const driver = await upsertUser('+250780000002', {
    role: 'DRIVER',
    name: 'Demo Driver',
    driver: { vehicleMake: 'Toyota', vehicleModel: 'Corolla', plateNumber: 'RAD 123 A' },
  })
  const passenger = await upsertUser('+250780000003', { role: 'PASSENGER', name: 'Demo Passenger' })

  console.log('Seeded:')
  console.log(`  admin     -> ${admin.id} (${admin.phone})`)
  console.log(`  driver    -> ${driver.id} (${driver.phone})`)
  console.log(`  passenger -> ${passenger.id} (${passenger.phone})`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
