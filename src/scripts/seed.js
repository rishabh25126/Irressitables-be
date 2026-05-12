const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const Startup = require('../models/Startup');

// Fallback to local if env is missing for dev purposes
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/investment-platform';

const dummyStartups = [
  {
    name: "PayStack AI",
    slug: "paystack-ai",
    tagline: "AI-powered payment reconciliation for enterprises",
    sector: "Fintech",
    stage: "Series A",
    description: "PayStack AI revolutionizes how enterprises handle payment reconciliation using advanced machine learning algorithms. Our platform processes millions of transactions daily, reducing reconciliation time by 95%.",
    problem: "Traditional payment reconciliation is manual, error-prone, and time-consuming. Finance teams spend countless hours matching transactions, leading to delayed closings and increased operational costs.",
    solution: "Our AI engine automatically matches transactions across multiple payment gateways, banks, and accounting systems with 99.9% accuracy. Real-time dashboards provide instant visibility into cash flow.",
    team: [
      { name: "Arjun Mehta", role: "CEO & Co-founder", linkedin: "https://linkedin.com" },
      { name: "Priya Sharma", role: "CTO & Co-founder", linkedin: "https://linkedin.com" },
      { name: "Vikram Singh", role: "VP Engineering", linkedin: "https://linkedin.com" },
    ],
    metrics: {
      revenueRange: "₹5-10Cr",
      growthPercent: 142,
      userBase: "150+ Enterprises",
      runway: "18 months",
    },
    fundingAsk: 250000000, // 25Cr
    isPublished: true,
  },
  {
    name: "MediSync",
    slug: "medisync",
    tagline: "Unified healthcare data platform",
    sector: "HealthTech",
    stage: "Seed",
    description: "MediSync creates a unified healthcare data ecosystem, enabling seamless information exchange between hospitals, clinics, laboratories, and patients.",
    problem: "Healthcare data is fragmented across multiple systems, leading to poor patient outcomes, duplicate tests, and inefficient care coordination.",
    solution: "Our HIPAA-compliant platform aggregates patient data from any source, creating a comprehensive health record accessible by authorized providers.",
    team: [
      { name: "Dr. Ananya Reddy", role: "CEO & Founder", linkedin: "https://linkedin.com" },
      { name: "Karthik Iyer", role: "CTO", linkedin: "https://linkedin.com" },
    ],
    metrics: {
      revenueRange: "₹1-3Cr",
      growthPercent: 89,
      userBase: "50+ Hospitals",
      runway: "14 months",
    },
    fundingAsk: 80000000,
    isPublished: true,
  },
  {
    name: "LearnVerse",
    slug: "learnverse",
    tagline: "Immersive VR learning experiences",
    sector: "EdTech",
    stage: "Pre-seed",
    description: "LearnVerse transforms education through immersive VR experiences, making complex subjects tangible and engaging for students of all ages.",
    problem: "Traditional education struggles to engage digital-native students. Abstract concepts remain difficult to grasp, leading to poor retention and outcomes.",
    solution: "Our VR platform creates interactive 3D environments where students can explore everything from molecular structures to historical events firsthand.",
    team: [
      { name: "Rahul Gupta", role: "CEO & Founder", linkedin: "https://linkedin.com" },
      { name: "Maya Krishnan", role: "Head of Product", linkedin: "https://linkedin.com" },
    ],
    metrics: {
      revenueRange: "₹20-50L",
      growthPercent: 215,
      userBase: "25 Schools",
      runway: "10 months",
    },
    fundingAsk: 30000000,
    isPublished: true,
  },
  {
    name: "CloudScale",
    slug: "cloudscale",
    tagline: "Automated infrastructure optimization",
    sector: "SaaS",
    stage: "Series A",
    description: "CloudScale helps companies reduce cloud infrastructure costs by up to 60% through intelligent workload optimization and automated resource management.",
    problem: "Cloud costs are spiraling out of control for most companies. Engineering teams lack visibility into spending and struggle to optimize resource utilization.",
    solution: "Our platform analyzes usage patterns, predicts demand, and automatically right-sizes infrastructure. One-click optimization saves companies millions annually.",
    team: [
      { name: "Sanjay Patel", role: "CEO & Co-founder", linkedin: "https://linkedin.com" },
      { name: "Deepa Nair", role: "CTO & Co-founder", linkedin: "https://linkedin.com" },
      { name: "Amit Joshi", role: "VP Sales", linkedin: "https://linkedin.com" },
    ],
    metrics: {
      revenueRange: "₹12-18Cr",
      growthPercent: 78,
      userBase: "200+ Companies",
      runway: "24 months",
    },
    fundingAsk: 400000000,
    isPublished: true, // featured: false in original, but published
  },
  {
    name: "QuickKart",
    slug: "quickkart",
    tagline: "10-minute grocery delivery platform",
    sector: "E-commerce",
    stage: "Series B",
    description: "QuickKart delivers groceries and essentials in under 10 minutes through a network of dark stores strategically placed across major cities.",
    problem: "Traditional grocery shopping is time-consuming. Existing delivery services are slow, often taking hours or requiring advance scheduling.",
    solution: "Our hyperlocal dark store network, combined with AI-powered inventory management, enables lightning-fast delivery while maintaining profitability.",
    team: [
      { name: "Ravi Kumar", role: "CEO & Founder", linkedin: "https://linkedin.com" },
      { name: "Sneha Agarwal", role: "COO", linkedin: "https://linkedin.com" },
      { name: "Vivek Menon", role: "CTO", linkedin: "https://linkedin.com" },
    ],
    metrics: {
      revenueRange: "₹50-80Cr",
      growthPercent: 156,
      userBase: "2M+ Customers",
      runway: "18 months",
    },
    fundingAsk: 800000000,
    isPublished: true,
  },
  {
    name: "GreenPower",
    slug: "greenpower",
    tagline: "Smart solar energy management",
    sector: "CleanTech",
    stage: "Series A",
    description: "GreenPower maximizes solar energy ROI for businesses through intelligent monitoring, predictive maintenance, and grid optimization.",
    problem: "Solar installations underperform by 20-30% due to poor monitoring, delayed maintenance, and suboptimal energy trading strategies.",
    solution: "Our IoT sensors and AI platform detect issues before they impact production, automatically optimize energy storage and grid selling for maximum returns.",
    team: [
      { name: "Nikhil Shah", role: "CEO & Co-founder", linkedin: "https://linkedin.com" },
      { name: "Pooja Desai", role: "CTO & Co-founder", linkedin: "https://linkedin.com" },
    ],
    metrics: {
      revenueRange: "₹8-12Cr",
      growthPercent: 95,
      userBase: "300+ Sites",
      runway: "20 months",
    },
    fundingAsk: 350000000,
    isPublished: true,
  },
  {
    name: "PropTech Hub",
    slug: "proptech-hub",
    tagline: "AI-powered property management",
    sector: "SaaS",
    stage: "Seed",
    description: "PropTech Hub streamlines property management with AI-powered tenant screening, automated maintenance scheduling, and smart rent collection.",
    problem: "Property managers juggle multiple tools and manual processes, leading to missed payments, delayed maintenance, and tenant churn.",
    solution: "Our unified platform automates 80% of property management tasks, from lease signing to maintenance coordination to financial reporting.",
    team: [
      { name: "Sameer Roy", role: "CEO & Founder", linkedin: "https://linkedin.com" },
      { name: "Anjali Bose", role: "Head of Product", linkedin: "https://linkedin.com" },
    ],
    metrics: {
      revenueRange: "₹80L-1.5Cr",
      growthPercent: 180,
      userBase: "5000+ Units",
      runway: "12 months",
    },
    fundingAsk: 60000000,
    isPublished: true,
  }
];

const seedDB = async () => {
  try {
    console.log('Connecting to MongoDB...', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    console.log('Clearing old data...');
    await Startup.deleteMany({});
    
    // Check if an admin user exists to link as the creator
    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.log('Creating default admin user: admin@ventureflow.com / admin123');
      admin = await User.create({
        name: 'System Admin',
        email: 'admin@ventureflow.com',
        passwordHash: 'admin123', // Mongoose pre-save hook will hash this
        role: 'admin'
      });
    }

    console.log('Inserting dummy startups...');
    const startupsWithCreator = dummyStartups.map(s => ({
      ...s,
      createdBy: admin._id
    }));

    await Startup.insertMany(startupsWithCreator);

    console.log('Seed successful! Added', dummyStartups.length, 'startups.');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
};

seedDB();
