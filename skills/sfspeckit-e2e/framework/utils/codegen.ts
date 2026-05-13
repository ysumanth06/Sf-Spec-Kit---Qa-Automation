import { spawn } from 'child_process';
import { getPersona, getConnection, getFrontdoorUrl } from './auth';

/**
 * Automatically launches Playwright Codegen (Record & Playback) authenticated 
 * into the target Salesforce org for a specific persona.
 * 
 * Usage: npx tsx utils/codegen.ts [PersonaName]
 */
async function launchCodegen() {
  const personaName = process.argv[2] || 'Admin';

  console.log(`\n🔍 Preparing Playwright Recorder for Persona: ${personaName}`);
  
  try {
    const user = getPersona(personaName);
    const conn = await getConnection(user);
    
    // Generates a frontdoor.jsp URL which automatically logs the browser into Salesforce
    const frontdoorUrl = await getFrontdoorUrl(conn);

    console.log(`✅ Successfully authenticated as ${user.username}`);
    console.log(`🚀 Launching Playwright Codegen...\n`);

    // Spawn the playwright codegen process
    const child = spawn('npx', ['playwright', 'codegen', frontdoorUrl], {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      console.log(`\n⏹️ Playwright Codegen exited with code ${code}`);
      process.exit(code || 0);
    });

  } catch (error) {
    console.error(`\n❌ Failed to launch Playwright Codegen:`);
    console.error(error);
    process.exit(1);
  }
}

launchCodegen();
