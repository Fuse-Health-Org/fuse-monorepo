import SequenceRun from '../../../models/SequenceRun';

/**
 * Calculate sequence analytics from all its runs
 */
export async function calculateSequenceAnalytics(sequenceId: string) {
  const runs = await SequenceRun.findAll({
    where: { sequenceId }
  });

  const totalRuns = runs.length;
  const completedRuns = runs.filter(r => r.status === 'completed').length;
  const totalEmailsSent = runs.reduce((sum, r) => sum + (r.emailsSent || 0), 0);
  const totalSmsSent = runs.reduce((sum, r) => sum + (r.smsSent || 0), 0);
  const totalEmailsOpened = runs.reduce((sum, r) => sum + (r.emailsOpened || 0), 0);
  const totalEmailsClicked = runs.reduce((sum, r) => sum + (r.emailsClicked || 0), 0);

  const totalSent = totalEmailsSent + totalSmsSent;
  const openRate = totalEmailsSent > 0 ? (totalEmailsOpened / totalEmailsSent) * 100 : 0;
  const clickRate = totalEmailsOpened > 0 ? (totalEmailsClicked / totalEmailsOpened) * 100 : 0;

  return {
    totalSent,
    openRate: Math.round(openRate * 10) / 10, // Round to 1 decimal
    clickRate: Math.round(clickRate * 10) / 10,
    activeContacts: completedRuns,
    totalRuns,
    completedRuns,
    emailsSent: totalEmailsSent,
    smsSent: totalSmsSent,
    emailsOpened: totalEmailsOpened,
    emailsClicked: totalEmailsClicked
  };
}

