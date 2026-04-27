# Project INSPIRE – User Manual

Welcome to **Project INSPIRE** (Inclusive Pedagogical System for Personalized Instruction and Resource Enhancement). This application is designed to help teachers create high-quality, Differentiated Lesson Plans (DLPs) tailored for learners with special educational needs.

This manual provides a comprehensive, step-by-step guide to using all features of the application, including advanced configuration for AI generation.

---

## Table of Contents
1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Creating a Differentiated Lesson Plan (DLP)](#creating-a-differentiated-lesson-plan-dlp)
4. [Managing Your Lessons](#managing-your-lessons)
5. [Reflections, Observations, and Surveys](#reflections-observations-and-surveys)
6. [Reminders & Tasks](#reminders--tasks)
7. [Resource Library](#resource-library)
8. [Learner Difficulty Library](#learner-difficulty-library)
9. [Advanced Settings & AI Configuration](#advanced-settings--ai-configuration)
10. [Profile & Account Management](#profile--account-management)
11. [Troubleshooting & FAQ](#troubleshooting--faq)

---

## Getting Started

### Installation
Project INSPIRE is a desktop application. To install it:
1. Download the installer for your operating system (Windows/macOS/Linux).
2. Run the installer and follow the on-screen prompts.
3. Once installed, launch the application from your Desktop or Applications folder.

### First-Time Login
When you first open the app, you will be greeted by the Login screen.
- **Default Account**: If your administrator has provided you with credentials, use them to log in.
- **Offline Mode**: The app works primarily offline, but an internet connection is required for **AI Lesson Generation**.

---

## Dashboard Overview

The Dashboard is your command center. It provides a quick glance at your teaching progress:
- **KPI Cards**: See the total number of Lessons, Reflections, Observations, and Surveys you've completed.
- **Recent Activity**: A list of your most recently created or edited lesson plans.
- **Quick Actions**: Buttons to start a new lesson plan or check for reminders.

---

## Creating a Differentiated Lesson Plan (DLP)

The core feature of Project INSPIRE is the **Lesson Workbench**, which uses a 5-step wizard to guide you through creating an inclusive lesson plan.

### Step 1: Lesson Context & Objectives
Fill in the basic pedagogical details:
- **Subject & Grade Level**: Specify what and who you are teaching.
- **Quarter & Week**: Align with the DepEd curriculum calendar.
- **Topic & Duration**: Define the scope and time for the lesson.
- **Standards & Objectives**: Input the content standards, performance standards, and specific learning competencies.

### Step 2: Understanding Your Learners (Difficulty Profile)
This step identifies the specific needs of your students. Select one or more of the **13 Difficulty Categories**, such as:
- Visual Impairment
- Hearing Impairment
- Learning Disability
- Autism Spectrum Disorder (ASD)
- Giftedness and Talent
- *And more...*

For each category selected, you can check specific **indicators** (e.g., "Difficulty in reading text" for Visual Impairment) to help the AI refine its suggestions.

### Step 3: Support Strategies & Designations
Choose how the lesson will be adapted:
- **Support Types**: Select adaptations like Learning Materials, Physical Environment, Communication, or Assessment adaptation.
- **Designations**: Identify who is involved (e.g., General Education Teacher, SPED Aide, Resource Teacher).

### Step 4: Adding Reference Materials
To make the AI-generated content more accurate, you can attach reference documents:
- Click **"Attach Documents"** to select files from your **Resource Library** or upload new ones.
- The AI will "read" these documents to ensure the lesson content matches your specific materials (e.g., a textbook chapter or a curriculum guide).

### Step 5: AI Generation & Review
Review your inputs and click **"Generate Lesson Plan"**.
- The generation happens in **three phases**:
    1. Curriculum & Objectives
    2. Teaching & Learning Procedure
    3. Inclusive Supports & Reflections
- **Wait for Completion**: Do not close the app while the AI is working. If a step times out, the app will attempt to save partial progress.

---

## Managing Your Lessons

Once a lesson is generated, it is stored in your database.
- **View**: Click the "View" button to see the full, formatted lesson plan.
- **Edit**: You can manually adjust any generated text to better fit your needs.
- **Print/Export**: Use the "Print Final" button to generate a professional DepEd-compliant PDF. You can also export to Microsoft Word for further manual formatting.
- **Status**: Lessons can be marked as **Draft** or **Final**.

---

## Reflections, Observations, and Surveys

To ensure the effectiveness of your inclusive teaching, use these tracking tools:

### Reflections
After teaching a lesson, create a **Reflection** entry.
- Rate the lesson's success on a scale of 1 to 5.
- Write notes on what worked well and what needs improvement for specific learners.

### Observations
If a supervisor or peer is observing your class, they can use the **Observations** module to record structured feedback across different lesson phases.

### Surveys
The **Surveys** section allows you to record responses from Likert-scale surveys regarding your self-efficacy or student engagement.

---

## Reminders & Tasks

Stay organized with the built-in **Reminders** system:
- **Create Reminders**: Add tasks like "Submit grades" or "Follow up with SPED aide".
- **Set Due Dates**: Assign a specific date to each task.
- **Track Completion**: Check off tasks as you finish them.
- **Dashboard View**: Your most urgent upcoming reminders are displayed directly on the Dashboard.

---

## Resource Library

The Resource Library is where you manage your documents (PDF, DOCX).
- **Upload**: Add new curriculum guides or teaching materials.
- **Search**: Quickly find documents to attach to your lesson plans.
- **Auto-Chunking**: When you upload a file, the app automatically processes it so the AI can reference specific parts efficiently.

---

## Learner Difficulty Library

The **Learner Difficulty Library** is a reference tool where you can explore the 13 difficulty categories in depth.
- **Overview**: Read detailed descriptions of each category.
- **Accommodation Tips**: Find suggested tips and reminders for specific learner needs.
- **Contextual Knowledge**: Use this to better understand the indicators you select during the Lesson Wizard.

---

## Advanced Settings & AI Configuration

Project INSPIRE allows you to use your own AI accounts for maximum control and performance.

### Setting Up Paid LLMs
Go to **Settings** in the sidebar to configure your AI providers.

#### 1. Supported Providers
- **OpenRouter**: The default provider. Supports a wide range of models (including free ones).
- **Gemini (Google)**: Highly recommended for speed and large context.
- **Claude (Anthropic)**: Excellent for pedagogical depth and nuance.
- **OpenAI**: The industry standard (GPT-4o).
- **Grok (xAI)**: Real-time information and conversational style.

#### 2. Obtaining API Keys
To use a paid provider, you need an API key:
- **OpenRouter**: Visit [openrouter.ai](https://openrouter.ai/) to create an account and generate a key.
- **Gemini**: Visit [Google AI Studio](https://aistudio.google.com/) to get a free or paid API key.
- **Claude**: Visit [Anthropic Console](https://console.anthropic.com/).
- **OpenAI**: Visit [OpenAI Platform](https://platform.openai.com/).

#### 3. Configuring the App
1. Open the **Settings** page.
2. Select your **Active Provider**.
3. Enter your **API Key** in the corresponding field.
4. (Optional) Select a **Preferred Model** (e.g., `google/gemini-pro-1.5`).
5. Click **Save LLM Settings**.

> [!IMPORTANT]
> Your API keys are stored **locally** on your device and are never sent to our servers. They are only used to communicate directly with the AI provider.

---

## Profile & Account Management

Manage your personal and professional details in the **My Profile** section:
- **Professional Info**: Update your designation, employee ID, and affiliated school. This information is used to pre-fill parts of your lesson plans.
- **Security**: Change your password regularly.
- **Research Consent**: If you are participating in the INSPIRE research study, ensure your consent is checked.

---

## Troubleshooting & FAQ

### Common Issues

**Q: The AI generation is taking too long or failing.**
- **Check Internet**: Ensure you have a stable internet connection.
- **API Key Credit**: If using a paid provider, check if you have remaining credits in your account.
- **Retry**: The app saves partial progress. You can usually resume generation if it fails midway.

**Q: I see a white screen when I launch the app.**
- This usually means a service failed to start. Try restarting the application. If it persists, contact technical support.

**Q: My PDF layout looks weird.**
- Ensure you are using a modern PDF viewer. The "Print Final" function is optimized for standard A4 or Letter paper sizes.

### Frequently Asked Questions

**Can I use the app without an internet connection?**
- Yes, for viewing, editing, and managing your existing data. However, **AI Generation** and **Initial Login** require an internet connection.

**Where is my data stored?**
- All your lessons, reflections, and documents are stored in a local database file (`inspire.db`) on your computer. Your data stays with you.

---

*For further assistance, please contact the Project INSPIRE technical team or refer to the internal documentation.*
