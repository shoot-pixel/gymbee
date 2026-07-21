import type { Database } from '../types/database';
import type { ExerciseMetadata } from '../services/coaching';

type ExerciseRow = Database['public']['Tables']['exercises']['Row'];

export function exerciseRowToMetadata(row: ExerciseRow): ExerciseMetadata {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    primaryMuscle: row.primary_muscle,
    secondaryMuscles: row.secondary_muscles,
    equipment: row.equipment,
    movementPattern: row.movement_pattern,
    difficulty: row.difficulty,
    jointStress: row.joint_stress,
    skillRequirement: row.skill_requirement,
  };
}
