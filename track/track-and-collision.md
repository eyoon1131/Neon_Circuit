Procedural Track Generation from Curve
===

### Assumptions

- the collider shape for the vehicle is a sphere; the track is C1 continuous.
- the initial position of the collider is always placed in a valid position.
- the width of the track is always wider than the diameter of the sphere, 
  and the closest distance between two points on a track curve is wider than the
  diameter as well.
- the track cannot be vertical at any given time.

### Definitions

Let our sphere collider $S = (\bold{p},r)$ where $\bold{p} \in \mathbb{R}^3$ is
the position, and $r\in\mathbb{R}$ is the radius; the track $T := (f, w)$, where 
curve function $f:\mathbb{R} \cap [0,1] \to \mathbb{R}^3$ and track width 
$w > 2r$.

At a position that meets the above assumptions, we have a function 
$\Phi: \mathbb{R}^3 \to \mathbb{R} \cap [0,1]$. It behaves the same as $f^{-1}$,
when the given point $\bold{x}$ is in the range of $f$; for an $\bold{x}$ not on
the curve, it gives the value $t$ such that $|f(t) - \bold{x}|$ is minimum.

### Track Generation and Collision Detection

Now, consider collider $S := (\bold{p},r)$ and $T := (f, w)$. 

The closest point on $t$ is computed by $t = \Phi(\bold{p})$; hence the point 
$\bold{x}$ on curve $f$ is $\bold{x} = f(t)$. 

Consider the tangent $\vec{f'(t)}$, $\vec{h} := \vec{f'} \times \vec{j}$, 
$\vec{n} := \vec{h} \times \vec{f'}$. Now, $\hat{n}$ is the normal vector when 
calculating the ground in collision, and $\hat{h}$ provides useful information 
when calculating collisions with side walls at this moment. Then, we just need
to decide the distance with the ground and walls and apply the penalty method.

#### Implementation of $\Phi$

Since the track can have multiple bumps, bisection won't work.

A simple implementation can be scanning through $[0,1]$ with $n$ discrete points, 
and then return the point with smallest distance. The quality entirely depends 
on how many scan-points we have. However, with too few scan points, the quality
can be concerning (a poorly estimated point can give strange forces); with too 
many scan points, the smoothness of the game can be impacted, since this is 
computed every physics update frame. Due to this issue, we must find a way to 
optimize.