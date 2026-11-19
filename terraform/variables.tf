variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "eu-west-1"
}

variable "project" {
  description = "Name prefix for all resources."
  type        = string
  default     = "yuma-shop"
}

variable "github_repository" {
  description = "GitHub repository allowed to deploy, in the form owner/name (for example Ogheneyomanice/yuma-skincare-shop)."
  type        = string
}

variable "create_github_oidc_provider" {
  description = "Create the GitHub OIDC identity provider. Set to false if your AWS account already has one."
  type        = bool
  default     = true
}

variable "image_tag" {
  description = "Image tag used for the very first deployment. The CI/CD pipeline replaces it afterwards."
  type        = string
  default     = "latest"
}

variable "desired_count" {
  description = "Initial number of running tasks (autoscaling manages it afterwards)."
  type        = number
  default     = 2
}

variable "max_count" {
  description = "Maximum number of tasks autoscaling may run."
  type        = number
  default     = 4
}
