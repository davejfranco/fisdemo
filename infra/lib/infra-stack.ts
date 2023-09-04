import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
//ECS
import * as ecs from 'aws-cdk-lib/aws-ecs';
//import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';



const prefix = 'FISDemo';

export class FisDemo extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //Infrastructure Network
    const vpcName = `${prefix}-VPC`;
    const vpcCidr = '10.0.0.0/16';
    const maxAzs = 3;
    
    const vpc = new ec2.Vpc(this, vpcName, {
      vpcName: vpcName,
      ipAddresses: ec2.IpAddresses.cidr(vpcCidr),
      //maxAzs: maxAzs,
      availabilityZones: ['us-east-1a', 'us-east-1b', 'us-east-1c'],
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: `${prefix}-Public`,
          mapPublicIpOnLaunch: true,
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],

      natGateways: 0,
      createInternetGateway: true,
    });
  
    //ECS Cluster
    //const cluster = new ecs.Cluster(this, `${prefix}-Cluster`, { vpc });
    const cluster = new ecs.Cluster(this, `${prefix}-Cluster`, {
      vpc: vpc,
      clusterName: `${prefix}-Cluster`,

      //optional
      containerInsights: false,
    });

    //ECS Cluster Capacity 
    cluster.addCapacity(`${prefix}-asg`, {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO), //new ec2.InstanceType('t3.micro'),
      desiredCapacity: 1,
      minCapacity: 1,
      maxCapacity: 1,
    });

    // Create Task Definition
    const taskDefinition = new ecs.Ec2TaskDefinition(this, 'TaskDef');
    const container = taskDefinition.addContainer('web', {
      image: ecs.ContainerImage.fromRegistry("nginx:1.24-alpine"),
      memoryLimitMiB: 256,
    });

    container.addPortMappings({
      containerPort: 80,
      hostPort: 8080,
      protocol: ecs.Protocol.TCP
    });

    // Create Service
    const service = new ecs.Ec2Service(this, 'Service', {
      cluster,
      taskDefinition,
    });

    // Create ALB
    const lb = new elbv2.ApplicationLoadBalancer(this, 'LB', {
      vpc,
      internetFacing: true
    });
    const listener = lb.addListener('PublicListener', { port: 80, open: true });

    // Attach ALB to ECS Service
    listener.addTargets('ECS', {
      port: 8080,
      targets: [service.loadBalancerTarget({
        containerName: 'web',
        containerPort: 80
      })],
      healthCheck: {
        interval: cdk.Duration.seconds(60),
        path: "/",
        timeout: cdk.Duration.seconds(5),
      }
    });
  }
}
