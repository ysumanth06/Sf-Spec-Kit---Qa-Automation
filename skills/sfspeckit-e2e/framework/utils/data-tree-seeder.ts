import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Data Tree Seeder for SFSpeckit E2E Framework
 * 
 * Uses Salesforce CLI (sf data tree import) to seed foundational relational data
 * into empty orgs (like Scratch Orgs) before baseline tests run.
 */
export class DataTreeSeeder {
    private targetOrg: string;
    private dataDirectory: string;

    constructor(targetOrg: string, dataDirectory: string = 'sfspeckit-data/seed-data') {
        this.targetOrg = targetOrg;
        this.dataDirectory = path.resolve(process.cwd(), dataDirectory);
    }

    /**
     * Initializes the org with data from a specific JSON plan
     * @param planFileName name of the JSON plan file (e.g., 'Account-Contact-plan.json')
     */
    public seedDataPlan(planFileName: string): boolean {
        const planPath = path.join(this.dataDirectory, planFileName);
        
        if (!fs.existsSync(planPath)) {
            console.warn(`[DataTreeSeeder] Warning: Data plan not found at ${planPath}`);
            return false;
        }

        console.log(`[DataTreeSeeder] Seeding data using plan: ${planFileName}...`);
        
        try {
            // Execute sf data tree import natively
            const command = `sf data tree import --plan "${planPath}" --target-org ${this.targetOrg} --json`;
            const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
            
            const result = JSON.parse(output);
            if (result.status === 0) {
                console.log(`[DataTreeSeeder] Successfully seeded data. Records imported: ${result.result.length}`);
                return true;
            } else {
                console.error(`[DataTreeSeeder] Error during data seeding:`, result);
                return false;
            }
        } catch (error: any) {
            console.error(`[DataTreeSeeder] Critical failure executing sf CLI:`, error.message);
            if (error.stdout) {
                console.error(`[DataTreeSeeder] CLI Output:`, error.stdout);
            }
            return false;
        }
    }
}
