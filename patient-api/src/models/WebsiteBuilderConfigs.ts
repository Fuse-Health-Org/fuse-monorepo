import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';

export const DEFAULT_FOOTER_DISCLAIMER = `* These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure or prevent any disease.

Information on this site is provided for informational purposes only. It is not meant to substitute for medical advice from your physician or other medical professional. You should not use the information contained herein for diagnosing or treating a health problem or disease, or prescribing any medication. Carefully read all product documentation. If you have or suspect that you have a medical problem, promptly contact your regular health care provider.

**Offer valid for new subscribers only. Valid on the first shipment only of one new AG1 and/or one new AGZ subscription. Renewals bill automatically at the then current rate until canceled. Cannot be combined with other offers or discounts and cannot be applied to prior purchases. One per customer. Non-transferable. Limited time only.

**AG1 Welcome Kit Offer valid for new AG1 subscribers only. AGZ frother Offer valid for first AGZ order only.

◊According to IQVIA Pro Voice Survey of 248 primary care physicians in December 2025.

††Free shipping on subscription purchases for new U.S. customers only.

In a triple-blind, randomized, placebo-controlled parallel-designed clinical trial evaluating nutrient biomarkers and microbiome shifts in 105 healthy adults ages 20-59 over the course of 12 weeks.

In a double-blind, randomized, placebo-controlled 2-week crossover clinical trial assessing nutrient gaps and microbiome shifts in 20 active adults ages 19-37.

In a double-blind, randomized, placebo-controlled 2-week crossover clinical trial assessing nutrient gaps and microbiome assessments of 24 healthy adults with occasional GI distress ages 26-59 over the course of 4 weeks.

In a double-blind, randomized, placebo-controlled crossover clinical trial assessing nutrient gaps and bioavailability in 16 healthy adults ages 18-42 over the course of 8 hours.

In a third-party, single-arm, closed label interventional study of 104 healthy adults ages 25-59 assessing self-perceived efficacy of AG1 Next Gen over 3 months.

ΔTruemed eligibility and approval required. This link will take you to a third party website hosted by Truemed (the "Site"). Linking to this Site does not constitute an endorsement or approval by AG1 or any of its employees of the content, products, services or opinions on the Site. This is being provided as a convenience and AG1 bears no responsibility for the accuracy, legality or content of the Site or for that of any subsequent links on the Site. Contact the owners of the Site for answers to questions regarding its content.

Actual Packaging May Vary

Your privacy is our priority. Learn more:`;

@Table({
  tableName: 'WebsiteBuilderConfigs',
  timestamps: true,
})
export class WebsiteBuilderConfigs extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({
    type: DataType.UUID,
  })
  declare id: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    defaultValue: DEFAULT_FOOTER_DISCLAIMER,
    comment: 'Default footer disclaimer text for all custom websites',
  })
  declare defaultFooterDisclaimer: string;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
