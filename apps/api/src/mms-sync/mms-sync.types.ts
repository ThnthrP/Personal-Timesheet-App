// รูปแบบข้อมูลจาก MMS: GET /api/integration/pta/master-data
// (backend/controllers/integrationController.js ฝั่ง MMS)

export interface MmsPosition {
    id: string;
    name: string;
}

export interface MmsEmployee {
    id: string;
    empCode: string;
    /** รหัสพนักงานฝั่ง client เช่น "38561733" — null ถ้ายังไม่ได้กรอกใน MMS,
     *  undefined ถ้า MMS ยังเป็นเวอร์ชันเก่าที่ไม่ส่ง field นี้ */
    empId?: string | null;
    name: string;
    positionId: string | null;
}

export interface MmsProject {
    code: string; // รหัส ON เช่น "ON/037-01/2026"
    name: string;
}

export interface MmsMasterData {
    generatedAt: string;
    positions: MmsPosition[];
    employees: MmsEmployee[];
    projects: MmsProject[];
}

export interface SyncCounts {
    created: number;
    updated: number;
    deactivated: number;
    unchanged: number;
}

export interface SyncSummary {
    trades: SyncCounts;
    workers: SyncCounts;
    projects: SyncCounts;
    /** พนักงานที่ MMS ยังไม่ได้ระบุตำแหน่ง — sync มาได้ แต่ Position / Trade จะไม่ขึ้นอัตโนมัติ */
    workersWithoutPosition: number;
}
