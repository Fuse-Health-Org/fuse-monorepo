import Clinic from "../../models/Clinic";
import User from "../../models/User";
import { Op } from "sequelize";

export const listClinicsWithOwners = async (options: { page: number; limit: number }) => {
  const { page, limit } = options;
  const offset = (page - 1) * limit;

  const { rows: clinics, count: total } = await Clinic.findAndCountAll({
    limit,
    offset,
    distinct: true,
    order: [['name', 'ASC']]
  });

  // FIX: Previously used Promise.all(clinics.map(...)) with a User.findOne per clinic (N+1 pattern).
  // This fired N concurrent queries which could spike Postgres connections and cause
  // "out of shared memory" errors. Replaced with a single bulk query + Map lookup.
  const clinicIds = clinics.map((c) => c.id);
  const owners = await User.findAll({
    where: { clinicId: clinicIds, role: 'brand' },
    attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'businessType', 'clinicId'],
  });

  const ownerByClinicId = new Map<string, any>();
  for (const o of owners) {
    if (o.clinicId && !ownerByClinicId.has(o.clinicId)) {
      ownerByClinicId.set(o.clinicId, o);
    }
  }

  const clinicsWithOwners = clinics.map((clinic) => {
    const owner = ownerByClinicId.get(clinic.id);
    return { ...clinic.toJSON(), owner: owner ? owner.toJSON() : null };
  });

  return {
    clinics: clinicsWithOwners,
    total,
    totalPages: Math.ceil(total / limit)
  };
};

export const getClinicWithOwner = async (clinicId: string) => {
  const clinic = await Clinic.findByPk(clinicId);
  if (!clinic) return null;

  const owner = await User.findOne({
    where: { 
      clinicId,
      role: 'brand'
    },
    attributes: [
      'id',
      'firstName', 
      'lastName',
      'email',
      'phoneNumber',
      'businessType'
    ]
  });

  return {
    ...clinic.toJSON(),
    owner: owner?.toJSON() || null
  };
};

export const listClinicsByUser = async (userId: string) => {
  return Clinic.findAll({
    where: {
      id: {
        [Op.in]: await User.findAll({
          where: { id: userId },
          attributes: ['clinicId']
        }).then(users => users.map(u => u.clinicId).filter(Boolean))
      }
    },
    order: [['name', 'ASC']]
  });
};