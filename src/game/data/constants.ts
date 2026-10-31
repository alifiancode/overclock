export const PLAYER_MOVE_SPEED = 8;

export const WORLD_SIZE = 576;
export const WORLD_HALF = WORLD_SIZE / 2;
export const CHUNK_SIZE = 64;
export const CHUNKS_PER_AXIS = WORLD_SIZE / CHUNK_SIZE;
export const STREET_PITCH = 36;
export const ROAD_HALF_WIDTH = 4.6;
export const SIDEWALK_WIDTH = 1.5;
export const WATER_LEVEL = -0.5;
export const CITY_LEVEL = 0.9;
export const VIEW_RADIUS = 78;
export const DESPAWN_RADIUS = 96;

export const FLOOR_HEIGHT = 3.2;
export const FLOOR_COUNT = 3;
export const WALL_THICKNESS = 0.25;
export const WALL_HEIGHT = FLOOR_COUNT * FLOOR_HEIGHT - 0.3;
export const DOOR_WIDTH = 2.2;
export const PLAYER_Y_LERP = 0.15;

export const CAMERA_OFFSET = { x: 10, y: 11, z: 10 };

export const ENEMY_SPAWN_RADIUS = 56;
export const WATER_SLOW_PLAYER = 0.78;
export const WATER_SLOW_ENEMY = 0.5;

export const PLAYER_ATTACK_RANGE = 6;
export const PLAYER_ATTACK_DAMAGE = 8;
export const PLAYER_ATTACK_COOLDOWN = 0.5;

export const GRID_CELL_SIZE = 5;

export const PLAYER_MAX_HEALTH = 100;

export const CAMERA_ROTATE_SPEED = 2;
export const CAMERA_DRAG_SENSITIVITY = 0.01;

export const DANGER_DIAL_DEFAULT = 3;
export const RUN_DURATION_SECONDS = 900;
export const PERMANENT_MAX_HEALTH_PER_LEVEL = 10;
export const PERMANENT_ATTACK_DAMAGE_PER_LEVEL = 2;
export const PERMANENT_MOVE_SPEED_PER_LEVEL = 0.05;
export const PERMANENT_DAMAGE_REDUCTION_PER_LEVEL = 0.02;
export const PERMANENT_REGEN_PER_LEVEL = 0.3;
export const PERMANENT_XP_BOOST_PER_LEVEL = 0.05;

export type BotModule = 'turret' | 'shield' | 'healer' | 'pulse';
export const BOT_MODULE_DEFAULT: BotModule = 'turret';
export const BOT_FOLLOW_OFFSET = { x: 2, y: 0.5, z: -2 };
export const BOT_FOLLOW_LERP = 0.08;

export const TURRET_RANGE = 7;
export const TURRET_DAMAGE = 4;
export const TURRET_COOLDOWN = 0.8;

export const SHIELD_RECHARGE_SECONDS = 8;
export const SHIELD_MAX_CHARGE = 1;

export const HEALER_REGEN_PER_SECOND = 2;

export const PULSE_RADIUS = 5.5;
export const PULSE_DAMAGE = 12;
export const PULSE_INTERVAL = 3.2;
export const PULSE_VISUAL_DURATION = 0.5;

export const RUSHER_BOB_FREQ = 10;
export const RUSHER_BOB_AMPLITUDE = 0.26;
export const RUSHER_LEAN_ANGLE = 0.45;
export const RANGED_BOB_FREQ = 3.2;
export const RANGED_BOB_AMPLITUDE = 0.2;
export const RANGED_YAW_WOBBLE_FREQ = 1.6;
export const RANGED_YAW_WOBBLE_AMPLITUDE = 0.7;
export const BRUISER_BOB_FREQ = 2;
export const BRUISER_BOB_AMPLITUDE = 0.4;
export const BRUISER_SQUASH_AMOUNT = 0.22;
export const IDLE_BOB_FREQ = 2;
export const IDLE_BOB_AMPLITUDE = 0.08;

export const ENEMY_ATTACK_ANIM_DURATION = 0.28;
export const RUSHER_LUNGE_DISTANCE = 0.9;
export const BRUISER_LUNGE_DISTANCE = 0.75;
export const RANGED_RECOIL_DISTANCE = 0.6;
export const ATTACK_SCALE_PULSE = 0.35;
export const RANGED_FLASH_COLOR = '#fff2b0';
export const RUSHER_GLOW_COLOR = '#c4ff4a';
export const RANGED_GLOW_COLOR = '#ff6a3a';
export const BRUISER_GLOW_COLOR = '#ff2a2a';

export const EXPLODER_LUNGE_DISTANCE = 1.15;
export const EXPLODER_PULSE_FREQ = 6;
export const EXPLODER_PULSE_AMOUNT = 0.07;
export const FLYER_LUNGE_DISTANCE = 1.6;
export const FLYER_HOVER_BOB_FREQ = 2.4;
export const FLYER_HOVER_BOB_AMPLITUDE = 0.3;
export const FLYER_WING_FLAP_FREQ = 9;
export const FLYER_WING_FLAP_AMOUNT = 0.85;