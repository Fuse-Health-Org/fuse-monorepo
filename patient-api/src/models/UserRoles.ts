import { Table, Column, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Entity from './Entity';
import User from './User';

@Table({
    freezeTableName: true,
    tableName: 'UserRoles',
    timestamps: true,
})
export default class UserRoles extends Entity {
    @ForeignKey(() => User)
    @Column({
        type: DataType.UUID,
        allowNull: false,
        unique: true, // One row per user
    })
    declare userId: string;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare patient: boolean;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare doctor: boolean;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare admin: boolean;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare brand: boolean;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare superAdmin: boolean;

    @Column({
        type: DataType.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    })
    declare affiliate: boolean;

    @BelongsTo(() => User)
    declare user: User;

    /**
     * Helper method to get all active roles for this user
     */
    getActiveRoles(): Array<'patient' | 'doctor' | 'admin' | 'brand' | 'superAdmin' | 'affiliate'> {
        const roles: Array<'patient' | 'doctor' | 'admin' | 'brand' | 'superAdmin' | 'affiliate'> = [];
        if (this.patient) roles.push('patient');
        if (this.doctor) roles.push('doctor');
        if (this.admin) roles.push('admin');
        if (this.brand) roles.push('brand');
        if (this.superAdmin) roles.push('superAdmin');
        if (this.affiliate) roles.push('affiliate');
        return roles;
    }

    /**
     * Helper method to check if user has a specific role
     */
    hasRole(role: 'patient' | 'doctor' | 'admin' | 'brand' | 'superAdmin' | 'affiliate'): boolean {
        return this[role] === true;
    }

    /**
     * Helper method to check if user has any of the specified roles
     */
    hasAnyRole(roles: Array<'patient' | 'doctor' | 'admin' | 'brand' | 'superAdmin' | 'affiliate'>): boolean {
        return roles.some(role => this[role] === true);
    }

    /**
     * Helper method to check if user has all of the specified roles
     */
    hasAllRoles(roles: Array<'patient' | 'doctor' | 'admin' | 'brand' | 'superAdmin' | 'affiliate'>): boolean {
        return roles.every(role => this[role] === true);
    }
}

