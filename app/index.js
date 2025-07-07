// libs for github 
const core = require('@actions/core');
const github = require('@actions/github');


async function run() {

    const environment = core.getInput('environment');
    const token = core.getInput('pat_token');
    const github_octokit = github.getOctokit(token);

    try {
        
        console.log(`Executing auto-approve. Environment: [${environment}].`);
        let pending_actions = await github_octokit.rest.actions.getPendingDeploymentsForRun({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            run_id: github.context.runId
        });

        let environment_ids = [];
        let official_reviewers = [];

        let is_reviewer = false;

        for (const pending_action of pending_actions.data) {

            if (pending_action.environment.name.toLowerCase() == environment.toLowerCase()) {

                environment_ids.push(pending_action.environment.id);

                for (const action_reviewer of pending_action.reviewers) {

                    // If the reviewer is a User
                    if (action_reviewer.type === 'User' && !is_reviewer) {
                        official_reviewers.push(action_reviewer.reviewer.login);
                        if (action_reviewer.reviewer.login === github.context.actor) {
                            is_reviewer = true;
                        }
                    }

                    // If the reviewer is a Team
                    if (action_reviewer.type === 'Team' && !is_reviewer) {

                        official_reviewers.push(action_reviewer.reviewer.name);
                        try {
                            
                            const response = await github_octokit.rest.teams.getMembershipForUserInOrg({
                                org: github.context.repo.owner,
                                team_slug: action_reviewer.reviewer.slug,
                                username: github.context.actor
                            });

                            console.log(`Team membership checked for requirer [${github.context.actor}] in team [${action_reviewer.reviewer.slug}]. Is reviewer? [${response.status === 200}]`);
                            if (response.status === 200) {
                                is_reviewer = true;
                            }
                        } catch (error) {
                            console.log(`Team membership check failed for requirer [${github.context.actor}] in team [${action_reviewer.reviewer.name}].`);
                        }
                    }
                }
            }
        }

        // if is passed an invalid environment, no auto-approve can be executed
        if(environment_ids.length == 0) {
            core.warning(`Auto-approve not executed: no valid environment with name ${environment} exists in this repository.`);
        } 

        // if the user is not a reviewer or part of a reviewer team, no auto-approve can be executed
        else if (!is_reviewer) {   
            core.warning(`Auto-approve not executed: user [${github.context.actor}] is not a reviewer in [${official_reviewers.join(',')}] for environments [${environment_ids.join(',')}].`);
        } 
        
        else {

            // if there is at least one running GH Action that requires manual approval, then approve it! 
            if (typeof environment_ids !== 'undefined' && environment_ids.length > 0) {

                // approve the pending run
                console.log(`Trying to execute automatic approve for run [${github.context.runId}] in environment [${environment_ids.join(',')}] for reviewer: [${github.context.actor}]`);
                await github_octokit.rest.actions.reviewPendingDeploymentsForRun({
                    owner: github.context.repo.owner,
                    repo: github.context.repo.repo,
                    run_id: github.context.runId,
                    environment_ids: environment_ids,
                    state: 'approved',
                    comment: `GitHub Action execution automatically approved in environment [${environment_ids.join(',')}] for reviewer: [${github.context.actor}].`
                });
                core.summary.addHeading(':white_check_mark: Automatically approved!');
                core.summary.write();
            }
        }

    } catch (error) {
        
        if (error.status && error.response && error.response.data) {
            core.warning(`Auto-approve not executed. Status: [${error.status}] Message: [${error.message}] Errors: [${JSON.stringify(error.response.data.errors, null, 2)}]`);
        } else {
            core.warning(`Auto-approve not executed. Error: ${error.message || error}`);
        }
    };
}

// finally, run the action
run();
