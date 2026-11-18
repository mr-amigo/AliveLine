import { Link } from 'react-router-dom'
import SiteLayout, { CONTACT_EMAIL, TextPage } from '../components/SiteLayout'
import { Button } from '../components/ui'
import { usePageMeta } from '../hooks/usePageMeta'

const UPDATED = '18 November 2026'
const Mail = () => <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>

export function Privacy() {
  usePageMeta('Privacy', 'What AliveLine stores, why, who processes it, and how to delete it.')
  return (
    <SiteLayout>
      <TextPage title="Privacy" updated={UPDATED}>
        <p>
          AliveLine is a student project from the Ukrainian Catholic University. We keep only what the planner needs to work
          and never sell or share it for advertising.
        </p>
        <h2>What we store</h2>
        <ul>
          <li>Account: your email, name and a hashed password (we never see the password itself).</li>
          <li>Planner data: assignments you add or import (title, description, course, deadline, hours, steps) and your planning settings.</li>
          <li>Sign-in times, to see how often the app is used.</li>
          <li>Early-access list: the email you leave on the home page.</li>
        </ul>
        <h2>AI estimates</h2>
        <p>
          When you ask for an estimate or for steps, the assignment’s title, description and course name are sent to OpenAI
          (model gpt-4.1-mini) to suggest hours. Your name and email are not sent. OpenAI does not use API data to train its models.
        </p>
        <h2>Cookies</h2>
        <p>
          We set one cookie, <code>al_session</code>, which keeps you signed in. It is strictly necessary, so there is no
          cookie banner. There are no analytics or tracking scripts.
        </p>
        <h2>Where it lives</h2>
        <p>
          Data is stored on Amazon Web Services in the United States (us-east-1), encrypted at rest and sent only over HTTPS.
        </p>
        <h2>Your rights</h2>
        <p>
          You can edit or delete any assignment in the app. To get a copy of your data or delete your account and everything
          in it, email <Mail />. We answer within 30 days.
        </p>
      </TextPage>
    </SiteLayout>
  )
}

export function Terms() {
  usePageMeta('Terms', 'The rules for using AliveLine.')
  return (
    <SiteLayout>
      <TextPage title="Terms" updated={UPDATED}>
        <p>By creating an account you agree to these terms. If you don’t agree, please don’t use AliveLine.</p>
        <h2>The service</h2>
        <p>
          AliveLine suggests when to start your assignments from the deadlines, hours and settings you give it. Estimates and
          plans are guidance, not a guarantee: always check the official deadline in Moodle or with your teacher.
        </p>
        <h2>Your account</h2>
        <ul>
          <li>Keep your password private; you are responsible for what happens in your account.</li>
          <li>Add only content you have the right to use. Don’t try to break, overload or misuse the service.</li>
        </ul>
        <h2>Availability</h2>
        <p>
          AliveLine is a student project offered as is, free of charge, without warranties. It may change, pause or end; we
          will try to warn you by email first so you can save your data.
        </p>
        <h2>Ending</h2>
        <p>You can stop using AliveLine at any time and ask us to delete your account. We may close accounts that break these terms.</p>
        <h2>Contact</h2>
        <p>Questions about these terms: <Mail />.</p>
      </TextPage>
    </SiteLayout>
  )
}

export function Contact() {
  usePageMeta('Contact', 'Questions, bugs or data requests: write to the AliveLine team.')
  return (
    <SiteLayout>
      <TextPage title="Contact">
        <p>Questions, a bug, an idea, or a request to export or delete your data? Write to us:</p>
        <p className="text-title font-semibold"><Mail /></p>
        <p className="text-text-2">
          Please include the email you signed up with and, for a bug, what you clicked and what you expected. We usually
          reply within two working days.
        </p>
      </TextPage>
    </SiteLayout>
  )
}

export function Thanks() {
  usePageMeta('You’re on the list', 'Thanks for joining the AliveLine early-access list.')
  return (
    <SiteLayout>
      <TextPage title="You’re on the list">
        <p>Thanks for your interest. We’ll email you when your invite is ready, usually within a week.</p>
        <p className="text-text-2">Can’t wait? Accounts are already open, so you can start planning now.</p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link to="/signup"><Button>Create free account</Button></Link>
          <Link to="/"><Button variant="secondary">Back to home</Button></Link>
        </div>
      </TextPage>
    </SiteLayout>
  )
}
