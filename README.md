# Auto-approve for GitHub Action
An action that permits to execute an auto-approve operation on scheduled or manually triggered GitHub Action pipeline.
In order to correctly execute the auto-approve operation, it is required to generate a PAT token with a user that is a a Deployment reviewer.

## How to use it
1) Configure a PAT token to be used for auto-approve validation. The token issuer must be a user that is a Deployment reviewer for your repository.
2) Use the auto-approve action on your GitHub Action
```
  create_runner:
    name: Create Runner
    runs-on: ubuntu-22.04
    environment:
      name: ${{ github.event.inputs.environment || 'prod' }}
    outputs:
      runner_name: ${{ steps.create_github_runner.outputs.runner_name }}
    steps:
      ...

  approve_create_runner:
    name: Execute auto-approve for 'Create Runner'
    runs-on: ubuntu-latest
    steps:
      - name: Auto approve
        uses: andrea-deri/auto-approve@v1.0.0
        with:
          pat_token: ${{ secrets.BOT_TOKEN }}
          environment: ${{ github.event.inputs.environment }}
```
