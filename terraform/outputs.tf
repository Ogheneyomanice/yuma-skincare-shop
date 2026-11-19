output "app_url" {
  description = "Public URL of the shop (HTTP)."
  value       = "http://${aws_lb.app.dns_name}"
}

output "ecr_repository_url" {
  description = "Where the CI/CD pipeline pushes images."
  value       = aws_ecr_repository.app.repository_url
}

output "github_actions_role_arn" {
  description = "Put this in the GitHub repository variable AWS_ROLE_ARN."
  value       = aws_iam_role.github_deploy.arn
}

output "github_variables" {
  description = "Values for GitHub -> Settings -> Secrets and variables -> Actions -> Variables."
  value = {
    AWS_REGION      = var.aws_region
    AWS_ROLE_ARN    = aws_iam_role.github_deploy.arn
    ECR_REPOSITORY  = aws_ecr_repository.app.name
    ECS_CLUSTER     = aws_ecs_cluster.main.name
    ECS_SERVICE     = aws_ecs_service.app.name
    ECS_TASK_FAMILY = aws_ecs_task_definition.app.family
    APP_URL         = "http://${aws_lb.app.dns_name}"
  }
}
