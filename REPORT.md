# Team Project CS C174C

Our game is a racing game!

## Algorithms Used

1. Symplectic Euler (for car physics simulation)
2. Hermite Interpolation (for procedural track generation as well as enemy car movement)
3. Collision Detection (for car, items, enemies, and track)
4. Spring-Damper System (for collision response/penalty)
5. Ease-in-out Interpolation (for animations)

### Symplectic Euler

### Hermite Interpolation

### Collision Detection

See `./collision/collision-handling.js` for implementation. Our track is based completely on a curve. So based on the car's location, we search for the closest point on the curve (`getFrame`, `getTimeOnCurve` in `./track/track-generate.js`), then by using the horizontal normal of the curve, we can locate the wall, and we detect collision based on distance to the wall (`detectTrackCollision`).

### Spring-Damper System

See `./collision/collision-handling.js` for implementation. When a collision is detected, we apply a penalty force to the car using spring damper system. We use the closest point from a car to the wall to ensure horizontal force application (`handleTrackCollision`).

### Ease-in-out Interpolation

We use ease-in-out when we animate the `3, 2, 1, GO!` as well as `lap completion`. See `./ui/ui.js` for implementation. In `StartAnimation` we use `2^{-5t}` as our easing function to let the numbers go from big to small. Then in `LapAnimation` we also use exponential ease-in and ease-out to slide the upper and lower banners as well as changing the opacity of the banner.

## Track Generation

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