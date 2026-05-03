import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'riders' })
export class RiderEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 320 })
  email: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 1000,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  balance: number;

  @Column({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
