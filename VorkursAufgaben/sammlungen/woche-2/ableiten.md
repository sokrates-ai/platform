## Ableitungsregeln 

Index | Aufgabenstellung |
-------- | ------------------- |
A | Berechne die Ableitung der gegebenen Funktion. |
B | Bestimme alle Extremstellen der gegebenen Funktion.  |
C | Berechne den gegebenen Term.  |

#### Schwierigkeit 1:

**A**:

**(1)** $ f\colon \realnum \rightarrow \realnum, x \mapsto 2x^2 + 4x^3+x-3$
#{$ \forall x \in \realnum: f'(x) = 4x + 12x^2 + 1 $}

**(2)** $ f\colon \realnum \rightarrow \realnum, x \mapsto 2\sqrt{x}$
#{$ \forall x \in \realnum: f'(x) = 1/\sqrt{x} $}

**B**:

**(1)** $ f\colon \realnum \rightarrow \realnum, x \mapsto 2x+3$
#{ keine Extremstellen }

**(2)** $ f\colon \realnum \rightarrow \realnum, x \mapsto x^2+1$
#{$ x=0 $ mit Wert $f(x) = 1$ }

<br>

#### Schwierigkeit 2:

**A**:

**(1)** $ f\colon \realnum \rightarrow \realnum, y \mapsto 2y^2+3$
#{$ \forall x \in \realnum: f'(x) = 4x $}

**(2)** $ f\colon \realnum \rightarrow \realnum, x \mapsto \sqrt[3]{x}+1$
#{$ \forall x \in \realnum: f'(x) = x^{-2/3}/3 $}

**B**:

**(1)** $ f\colon \realnum \rightarrow \realnum, x \mapsto e^x+e^{-x}$
#{ $ x=0 $ mit Wert $f(x) = 2$ }

**(2)** $ f\colon \realnum \rightarrow \realnum, x \mapsto -2x^3 - 12 x^2 + 30 x + 12$
#{ $ -5 $ und $ 1 $ }

<br>

#### Schwierigkeit 3:

**A**:

**(1)** $ f\colon \realnum \rightarrow \realnum, y \mapsto e^{\sqrt{2x+3}}$
#{$ \forall x \in \realnum: f'(x) = 4x $}

**(2)** $ f\colon \realnum \rightarrow \realnum, x \mapsto ln(1+x^2)$
#{$ \forall x \in \realnum: f'(x) = x^{-2/3}/3 $}

**B**:

**(1)** $ f\colon \realnum \rightarrow \realnum, x \mapsto \frac{2 x}{1 + x^2}$
#{ Maximum bei $ x=1 $ mit Wert $f(x) = 1$, Minimum bei $ x=-1$ mit Wert $-1$ }

**(2)** $ f\colon \realnum \rightarrow \realnum, x \mapsto e^x-1-x$
#{ Minimum bei $ x=0 $ mit Wert $f(x) = 0$ }

**C**:

**(1)** $\frac{d}{dx} x^2 \cdot y$;
#{ $2xy$ }

**(2)** $\frac{d}{dy} x^2 \cdot y$;
#{ $x^2$ }

**(3)** $\frac{d}{dz} x^2 \cdot y$;
#{ $0$ }

**(4)** $\frac{d}{dx} \exp(y) + x^2+y$.
{ $2x$ }

**(5)** $\frac{d}{d\sigma} x\cdot e^{\sigma^2}$
#{ $2 \sigma x e^{\sigma^2}$ }

**(6)** $\frac{d}{da} abc$
#{ $bc$ }

<br>

#### Schwierigkeit 4:

**B**:

(1) Zeige, dass für alle $y \in \realnum$ gilt, dass $\frac{2 y}{1 + y^2}$ ein Wert in $[-1,1]$ ist.
*{ Lokale Extremstellen wurden bereits in 3B1 berechnet; Konvergenz bei y nach $\infty$ und $-\infty$ ODER Monotonie durch Ableiten zeigt die Aussage }*

(2) Du möchtest in einer Gensequenz mit $n$ Basenpaaren genau ein konkretes Verändern, um eine Krankheit zu heilen; alle anderen sollen intakt bleiben. Dies kannst du jetzt erreichen, indem du die Zellen bestrahlst; durch geschicktes Dosieren der Strahlung kannst du jeden beliebigen Parameter $p$ erzielen, welcher die Wahrscheinlichkeit angibt, mit der unabhängig jedes der Basenpaare verändert wird.

Sollte nicht genau nur das eine Zielbasenpaar verändert werden, repariert der Körper die Veränderung und alles bleibt beim Alten. Sollte genau das eine Zielbasenpaar verändert werden, ist die Krankheit geheilt. Wie sollte $p$ eingestellt werden, um die Chance auf Heilung zu maximieren?

**C**:

**(1)** $\frac{d}{dx} \frac{d}{dy} \exp(y) + x^2 + yx$.
#{ $1$ }

**(2)** $\frac{d}{d\sigma} \frac{d}{d\sigma} x\cdot e^{\sigma^2}$
{ $4 \sigma^2 x e^{\sigma^2} + 2xe^{\sigma^2}$ }

**(3)** $\frac{d}{db} \left( \frac{d}{da} abc \right)$
{ $c$ }

**(4)** $\frac{d}{dx_1} \prod_{i=1}^n x_i$
{ $\frac{d}{dx_1} \prod_{i=2}^n x_i$ }

**(5)** $\frac{d}{dx_1} \sum_{i=1}^n (n-i) \cdot x_i$
*{ $n-1$ }*

<br>

#### Schwierigkeit 5:

**A**:

(1) $ $
*{Antwort}*