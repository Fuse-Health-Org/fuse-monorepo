import Clinic from '../../../models/Clinic';
import { Op } from 'sequelize';

/**
 * Generate unique clinic slug from clinic name
 */
export async function generateUniqueSlug(
  clinicName: string,
  excludeId?: string
): Promise<string> {
  const baseSlug = clinicName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const whereClause: any = { slug: baseSlug };
  if (excludeId) {
    whereClause.id = { [Op.ne]: excludeId };
  }

  const existingClinic = await Clinic.findOne({ where: whereClause });

  if (!existingClinic) {
    return baseSlug;
  }

  let counter = 1;
  while (true) {
    const slugWithNumber = `${baseSlug}-${counter}`;
    const whereClauseWithNumber: any = { slug: slugWithNumber };
    if (excludeId) {
      whereClauseWithNumber.id = { [Op.ne]: excludeId };
    }

    const existingWithNumber = await Clinic.findOne({
      where: whereClauseWithNumber,
    });

    if (!existingWithNumber) {
      return slugWithNumber;
    }

    counter++;
  }
}

