const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
const path = require("path")
require("dotenv").config({ path: path.join(__dirname, "../../.env") })

const User = require("../models/User")
const Business = require("../models/Business")
const Document = require("../models/Document")
const InvestorAccess = require("../models/InvestorAccess")
const OwnerAccess = require("../models/OwnerAccess")
const EquityRequest = require("../models/EquityRequest")
const AuditLog = require("../models/AuditLog")

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/investment-platform"

const dummyBusinesses = [
  {
    name: "Saffron Sips",
    slug: "saffron-sips",
    tagline: "Premium bottled chai and cold brew for modern retail shelves",
    sector: "Food & Beverages",
    stage: "Series A",
    description:
      "Saffron Sips builds premium Indian beverage brands for modern trade, quick commerce, and corporate pantry programs.",
    problem:
      "Most heritage-inspired beverage brands struggle to scale beyond boutique distribution while maintaining quality and shelf consistency.",
    solution:
      "Saffron Sips combines central production, strong retail distribution, and data-led merchandising to scale repeatable beverage SKUs nationwide.",
    team: [
      {
        name: "Aarav Bedi",
        role: "CEO & Co-founder",
        linkedin: "https://linkedin.com",
      },
      {
        name: "Nisha Kapoor",
        role: "COO & Co-founder",
        linkedin: "https://linkedin.com",
      },
    ],
    metrics: {
      revenueRange: "₹4-7Cr",
      growthPercent: 118,
      userBase: "1,200+ Stores",
      runway: "20 months",
    },
    fundingAsk: 180000000,
    isPublished: true,
  },
  {
    name: "Crumb & Co",
    slug: "crumb-co",
    tagline:
      "Fast-growing artisanal bakery chain with cloud-kitchen efficiency",
    sector: "Food & Beverages",
    stage: "Seed",
    description:
      "Crumb & Co operates neighborhood bakery cafes with centralized prep and strong delivery economics.",
    problem:
      "Independent bakeries face margin pressure from fragmented sourcing, uneven demand, and poor fulfillment systems.",
    solution:
      "Crumb & Co standardizes production, reduces wastage, and improves repeat demand through memberships, catering, and omnichannel delivery.",
    team: [
      {
        name: "Mihika Rao",
        role: "Founder & CEO",
        linkedin: "https://linkedin.com",
      },
      {
        name: "Kabir Sethi",
        role: "Operations Lead",
        linkedin: "https://linkedin.com",
      },
    ],
    metrics: {
      revenueRange: "₹1-2Cr",
      growthPercent: 86,
      userBase: "48K Annual Orders",
      runway: "15 months",
    },
    fundingAsk: 70000000,
    isPublished: true,
  },
  {
    name: "Threadline House",
    slug: "threadline-house",
    tagline: "Digitally native ethnicwear label with high repeat purchase",
    sector: "Fashion & Retail",
    stage: "Series A",
    description:
      "Threadline House designs premium ethnicwear collections sold through D2C, marketplaces, and select experience stores.",
    problem:
      "Fashion brands often lose margin and demand visibility due to poor inventory planning and disconnected sales channels.",
    solution:
      "Threadline House runs small-batch drops, fast replenishment loops, and channel-aware merchandising to improve sell-through and cash cycles.",
    team: [
      {
        name: "Sara Malhotra",
        role: "CEO & Creative Director",
        linkedin: "https://linkedin.com",
      },
      { name: "Dev Oberoi", role: "COO", linkedin: "https://linkedin.com" },
    ],
    metrics: {
      revenueRange: "₹6-9Cr",
      growthPercent: 132,
      userBase: "95K Customers",
      runway: "18 months",
    },
    fundingAsk: 220000000,
    isPublished: true,
  },
  {
    name: "AisleOne",
    slug: "aisleone",
    tagline:
      "Specialty retail chain for home, gifting, and seasonal merchandise",
    sector: "Fashion & Retail",
    stage: "Seed",
    description:
      "AisleOne operates compact high-turn retail stores blending home accents, festive gifting, and private-label accessories.",
    problem:
      "Offline specialty retail lacks reliable merchandising data, causing overstocks, markdowns, and low conversion from walk-ins.",
    solution:
      "AisleOne uses centralized assortment planning, private-label margins, and store-level analytics to improve inventory turns and conversion.",
    team: [
      {
        name: "Rohan Taneja",
        role: "Founder & CEO",
        linkedin: "https://linkedin.com",
      },
      {
        name: "Megha Arora",
        role: "Merchandising Lead",
        linkedin: "https://linkedin.com",
      },
    ],
    metrics: {
      revenueRange: "₹2-4Cr",
      growthPercent: 74,
      userBase: "12 Stores",
      runway: "14 months",
    },
    fundingAsk: 90000000,
    isPublished: true,
  },
  {
    name: "Rinse Ritual",
    slug: "rinse-ritual",
    tagline: "Tech-enabled premium laundromat chain for urban neighborhoods",
    sector: "Laundromats",
    stage: "Series A",
    description:
      "Rinse Ritual runs branded laundromat stores with subscription plans, pick-up/drop, and machine utilization analytics.",
    problem:
      "Traditional laundromats remain operationally fragmented, with weak customer retention and poor visibility into throughput and service quality.",
    solution:
      "Rinse Ritual combines app-led convenience, standardized store operations, and subscription loyalty to create a scalable neighborhood services brand.",
    team: [
      {
        name: "Ishaan Verma",
        role: "CEO & Founder",
        linkedin: "https://linkedin.com",
      },
      {
        name: "Pallavi Jain",
        role: "Head of Operations",
        linkedin: "https://linkedin.com",
      },
    ],
    metrics: {
      revenueRange: "₹3-6Cr",
      growthPercent: 109,
      userBase: "22K Subscribers",
      runway: "19 months",
    },
    fundingAsk: 160000000,
    isPublished: true,
  },
  {
    name: "Spin Cycle Co",
    slug: "spin-cycle-co",
    tagline:
      "Compact laundromat franchise model for apartment-first catchments",
    sector: "Laundromats",
    stage: "Pre-seed",
    description:
      "Spin Cycle Co is building a franchise-ready laundromat format optimized for apartment clusters and gated communities.",
    problem:
      "Community laundry services are inconsistent, under-branded, and operationally difficult to monitor across micro-locations.",
    solution:
      "Spin Cycle Co offers compact store design, remote machine telemetry, and franchise dashboards that simplify rollout and service reliability.",
    team: [
      {
        name: "Anmol Khanna",
        role: "Founder",
        linkedin: "https://linkedin.com",
      },
      {
        name: "Vidhi Suri",
        role: "Franchise Ops",
        linkedin: "https://linkedin.com",
      },
    ],
    metrics: {
      revenueRange: "₹60L-1.2Cr",
      growthPercent: 68,
      userBase: "9 Pilot Locations",
      runway: "11 months",
    },
    fundingAsk: 40000000,
    isPublished: true,
  },
  {
    name: "TailTrail",
    slug: "tailtrail",
    tagline: "Subscription-led pet wellness, grooming, and essentials platform",
    sector: "Pet Industry",
    stage: "Series B",
    description:
      "TailTrail serves pet parents through subscriptions, clinic partnerships, grooming centers, and a high-repeat essentials catalog.",
    problem:
      "Pet care spending is fragmented across grooming, nutrition, accessories, and care providers, limiting brand trust and recurring revenue.",
    solution:
      "TailTrail integrates recurring commerce, wellness reminders, and offline care fulfillment into one consumer pet ecosystem.",
    team: [
      {
        name: "Zoya Merchant",
        role: "CEO & Co-founder",
        linkedin: "https://linkedin.com",
      },
      {
        name: "Harshad Vora",
        role: "COO & Co-founder",
        linkedin: "https://linkedin.com",
      },
    ],
    metrics: {
      revenueRange: "₹10-14Cr",
      growthPercent: 144,
      userBase: "140K Pet Families",
      runway: "21 months",
    },
    fundingAsk: 280000000,
    isPublished: true,
  },
  {
    name: "Paws & Play",
    slug: "paws-and-play",
    tagline:
      "Neighborhood pet retail and daycare brand with recurring memberships",
    sector: "Pet Industry",
    stage: "Seed",
    description:
      "Paws & Play combines pet retail, daycare, grooming, and weekend community events in neighborhood-first formats.",
    problem:
      "Pet parents often juggle multiple disconnected local providers for food, care, grooming, and boarding.",
    solution:
      "Paws & Play creates a trusted local pet-services brand with repeat visits, memberships, and higher-margin ancillary services.",
    team: [
      {
        name: "Ira Menon",
        role: "Founder & CEO",
        linkedin: "https://linkedin.com",
      },
      {
        name: "Sarthak Nair",
        role: "Operations Head",
        linkedin: "https://linkedin.com",
      },
    ],
    metrics: {
      revenueRange: "₹1.5-3Cr",
      growthPercent: 91,
      userBase: "18K Members",
      runway: "13 months",
    },
    fundingAsk: 80000000,
    isPublished: true,
  },
]

async function ensureAdminUser() {
  let admin = await User.findOne({
    email: { $in: ["admin@irressitables.com", "admin@ventureflow.com"] },
  })
  if (admin) {
    if (admin.email !== "admin@irressitables.com") {
      admin.email = "admin@irressitables.com"
      await admin.save()
    }
    return admin
  }

  const passwordHash = await bcrypt.hash("admin123", 12)
  admin = await User.create({
    name: "System Admin",
    email: "admin@irressitables.com",
    passwordHash,
    role: "admin",
  })
  return admin
}

async function ensureOwnerUser() {
  let owner = await User.findOne({
    email: { $in: ["owner@irressitables.com", "owner@ventureflow.com"] },
  })
  if (owner) {
    if (owner.email !== "owner@irressitables.com") {
      owner.email = "owner@irressitables.com"
      await owner.save()
    }
    return owner
  }

  owner = await User.create({
    name: "Business Owner",
    email: "owner@irressitables.com",
    passwordHash: "owner123",
    role: "owner",
  })
  return owner
}

async function ensureInvestorUser() {
  let investor = await User.findOne({
    email: { $in: ["investor@irressitables.com", "investor@ventureflow.com"] },
  })
  if (investor) {
    if (investor.email !== "investor@irressitables.com") {
      investor.email = "investor@irressitables.com"
      await investor.save()
    }
    return investor
  }

  investor = await User.create({
    name: "Sample Investor",
    email: "investor@irressitables.com",
    passwordHash: "investor123",
    role: "investor",
  })
  return investor
}

async function resetCollections() {
  await Promise.all([
    mongoose.connection
      .collection("businesses")
      .deleteMany({})
      .catch(() => {}),
    Document.deleteMany({}),
    InvestorAccess.deleteMany({}),
    OwnerAccess.deleteMany({}),
    EquityRequest.deleteMany({}),
    AuditLog.deleteMany({}),
  ])
}

async function seedDB() {
  try {
    await mongoose.connect(MONGO_URI)

    await resetCollections()
    const admin = await ensureAdminUser()
    const owner = await ensureOwnerUser()
    const investor = await ensureInvestorUser()

    const createdBusinesses = await Business.insertMany(
      dummyBusinesses.map((business) => ({
        ...business,
        createdBy: admin._id,
      }))
    )

    const primaryBusiness =
      createdBusinesses.find((business) => business.slug === "paws-and-play") ||
      createdBusinesses[0]

    await OwnerAccess.create({
      ownerId: owner._id,
      businessId: primaryBusiness._id,
      grantedBy: admin._id,
    })

    await InvestorAccess.create({
      investorId: investor._id,
      businessId: primaryBusiness._id,
      investedAmount: 2500000,
      shares: 50000,
      equityPercentage: 5,
      grantedBy: admin._id,
    })

    console.log(`Seed successful. Added ${dummyBusinesses.length} businesses.`)
    process.exit(0)
  } catch (err) {
    console.error("Seed failed:", err)
    process.exit(1)
  }
}

seedDB()
