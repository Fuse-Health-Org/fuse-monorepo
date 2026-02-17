'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Program', 'formStepOrder', {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Program-level intake section order. Payment must be last.',
    });

    await queryInterface.addIndex('Program', ['formStepOrder'], {
      name: 'program_form_step_order_idx',
      using: 'gin',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Program', 'program_form_step_order_idx');
    await queryInterface.removeColumn('Program', 'formStepOrder');
  },
};
