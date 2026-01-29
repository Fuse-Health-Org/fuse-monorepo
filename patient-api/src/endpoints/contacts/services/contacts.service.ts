import User from '../../../models/User';
import SequenceRun from '../../../models/SequenceRun';
import { Op } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

/**
 * Get last contact date for a user (last sequence run created)
 */
export async function getLastContactDate(userId: string): Promise<Date | null> {
  try {
    const lastRun = await SequenceRun.findOne({
      where: Sequelize.literal(`payload::text LIKE '%${userId}%'`),
      order: [['createdAt', 'DESC']],
      limit: 1
    });

    return lastRun ? lastRun.createdAt : null;
  } catch (error) {
    console.error('Error getting last contact date:', error);
    return null;
  }
}

/**
 * Count total sequences sent to a user
 */
export async function getTotalSequencesSent(userId: string): Promise<number> {
  try {
    const count = await SequenceRun.count({
      where: Sequelize.literal(`payload::text LIKE '%${userId}%'`)
    });

    return count;
  } catch (error) {
    console.error('Error getting total sequences sent:', error);
    return 0;
  }
}

/**
 * Get engagement stats for a user
 */
export async function getUserEngagementStats(userId: string) {
  try {
    const runs = await SequenceRun.findAll({
      where: Sequelize.literal(`payload::text LIKE '%${userId}%'`)
    });

    const totalSent = runs.length;
    const totalEmailsSent = runs.reduce((sum, r) => sum + (r.emailsSent || 0), 0);
    const totalSmsSent = runs.reduce((sum, r) => sum + (r.smsSent || 0), 0);
    const totalEmailsOpened = runs.reduce((sum, r) => sum + (r.emailsOpened || 0), 0);
    const totalEmailsClicked = runs.reduce((sum, r) => sum + (r.emailsClicked || 0), 0);

    const openRate = totalEmailsSent > 0 ? (totalEmailsOpened / totalEmailsSent) * 100 : 0;
    const clickRate = totalEmailsOpened > 0 ? (totalEmailsClicked / totalEmailsOpened) * 100 : 0;

    return {
      totalSequences: totalSent,
      emailsSent: totalEmailsSent,
      smsSent: totalSmsSent,
      emailsOpened: totalEmailsOpened,
      emailsClicked: totalEmailsClicked,
      openRate: Math.round(openRate * 10) / 10,
      clickRate: Math.round(clickRate * 10) / 10
    };
  } catch (error) {
    console.error('Error getting user engagement stats:', error);
    return {
      totalSequences: 0,
      emailsSent: 0,
      smsSent: 0,
      emailsOpened: 0,
      emailsClicked: 0,
      openRate: 0,
      clickRate: 0
    };
  }
}

