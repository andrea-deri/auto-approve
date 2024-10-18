// libs for github 
const core = require('@actions/core');
const github = require('@actions/github');


async function run() {

    const environment = core.getInput('environment');
    console.log(`Executing auto-approve on ${environment} environment...`);

    const github_octokit = github.getOctokit(GITHUB_TOKEN);
    const GITHUB_TOKEN = core.getInput('GITHUB_TOKEN');

    try {
        
        let pending_actions = await github_octokit.rest.actions.getPendingDeploymentsForRun({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            run_id: github.context.runId
        });

        let env_id = [];
        let env_name = '';
        let reviewers = [];
        let is_reviewer = false;
        let found_env = false;

        pending_actions.data.forEach(env => {
            
            if (env.environment.name.toLowerCase() == environment.toLowerCase()) {
                
                found_env = true;
                env_id.push(env.environment.id);
                env_name = env_name + env.environment.name + ',';

                // check if the current user is a reviewer for the environment
                env.reviewers.forEach(async reviewerObj => {

                    // If the reviewer is a User
                    if (reviewerObj.type == 'User' && !is_reviewer) {
                        reviewers.push(reviewerObj.reviewer.login);
                        if (reviewerObj.reviewer.login == github.context.actor) {
                            is_reviewer = true;
                        }
                    }

                    // If the reviewer is a Team
                    if (reviewerObj.type == 'Team' && !is_reviewer) {

                        reviewers.push(reviewerObj.reviewer.name);
                        await github_octokit.rest.teams.getMembershipForUserInOrg({
                            org: github.context.repo.owner,
                            team_slug: reviewerObj.reviewer.slug,
                            username: github.context.actor
                        }).then((response) => {
                            
                            console.log(` team membership checked for ${github.context.actor} in team ${reviewerObj.reviewer.slug}`);
                            console.log(` response: ${response.status}`);
                            if (response.status == 200) {
                                is_reviewer = true;
                            }
                        }).catch((error) => {
                            console.log(` team membership check failed for ${github.context.actor} in team ${reviewerObj.reviewer.name}`);
                        });;
                    }
                });
            }
        });

        // if the environment passed was not found in the list of environment to pre-approve 
        if(!found_env) {
            console.log(`ERROR: environment ${envIn} not found.`);
            core.warning(`env '${envIn}' is not part of the workflow or deployment was already approved by one of the reviewers`);
            return;
        }

        // if the current user is not a reviewer, display the list of reviewers and exit
        if (!is_reviewer) {
            console.log(`ERROR: ${github.context.actor} is not a reviewer in ${reviewers}`);         
            core.notice('Auto Approval Not Possible; current user is not a reviewer for the environment(s) - ' + env_name.trimEnd(','));
            core.info('Reviewers: ' + (reviewers.join(',')));
            return;
        } 
        
        else {
            // Approve, in case of there is any pending review requests
            if (typeof env_id !== 'undefined' && env_id.length > 0) {
                // Approve the pending deployment reviews
                await github_octokit.rest.actions.reviewPendingDeploymentsForRun({
                    owner: github.context.repo.owner,
                    repo: github.context.repo.repo,
                    run_id: github.context.runId,
                    environment_ids: env_id,
                    state: 'approved',
                    comment: 'Auto-Approved by GitHub Action for environment(s) - ' + env_name.trimEnd(',') 
                });
                // Adding to deployment Summary
                core.summary.addHeading(' :white_check_mark: Auto Approval Status');
                core.summary.addQuote('Auto-Approved by GitHub Action. Reviewer: ' + github.context.actor);
                core.summary.write();
            }
        }

    } catch (error) {
        console.log(error);
    };
}

// finally, run the action
run();
